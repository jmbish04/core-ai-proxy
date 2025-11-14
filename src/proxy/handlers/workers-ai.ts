/**
 * Intelligent Workers AI Router
 *
 * This handler implements a sophisticated routing system for Cloudflare Workers AI:
 * 1. Specific Model Routing: Direct requests with specific models
 * 2. Feature-Based Routing: Routes based on required capabilities (tools, JSON)
 * 3. Complexity-Based Routing: Triages simple vs complex prompts
 *
 * @module proxy/handlers/workers-ai
 */

import type { ChatCompletionRequest, ChatCompletionResponse, Message, Env } from '../../types';
import { generateText, generateTextStream } from '../../utils/ai';

/**
 * Model capabilities and configuration
 */
interface ModelCapabilities {
  id: string;
  name: string;
  supportsTools: boolean;
  supportsJSON: boolean;
  supportsStreaming: boolean;
  complexity: 'fast' | 'balanced' | 'powerful';
  contextWindow: number;
}

/**
 * Registry of Workers AI models with their capabilities
 * This is the "magic" - knowing each model's specific capabilities
 */
const WORKERS_AI_MODELS: ModelCapabilities[] = [
  {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B',
    supportsTools: true,
    supportsJSON: true,
    supportsStreaming: true,
    complexity: 'fast',
    contextWindow: 8192,
  },
  {
    id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    name: 'Llama 3.3 70B',
    supportsTools: true,
    supportsJSON: true,
    supportsStreaming: true,
    complexity: 'powerful',
    contextWindow: 16384,
  },
  {
    id: '@cf/meta/llama-3-8b-instruct',
    name: 'Llama 3 8B',
    supportsTools: false,
    supportsJSON: false,
    supportsStreaming: true,
    complexity: 'fast',
    contextWindow: 8192,
  },
  {
    id: '@cf/mistral/mistral-7b-instruct-v0.1',
    name: 'Mistral 7B',
    supportsTools: false,
    supportsJSON: false,
    supportsStreaming: true,
    complexity: 'fast',
    contextWindow: 8192,
  },
  {
    id: '@cf/qwen/qwen1.5-14b-chat-awq',
    name: 'Qwen 1.5 14B',
    supportsTools: false,
    supportsJSON: true,
    supportsStreaming: true,
    complexity: 'balanced',
    contextWindow: 8192,
  },
];

/**
 * Get model capabilities by ID
 */
function getModelCapabilities(modelId: string): ModelCapabilities | undefined {
  return WORKERS_AI_MODELS.find(m => m.id === modelId);
}

/**
 * Find the best model for specific requirements
 */
function findModelForFeatures(requirements: {
  tools?: boolean;
  json?: boolean;
  complexity?: 'fast' | 'balanced' | 'powerful';
}): ModelCapabilities {
  // Filter models that meet the requirements
  let candidates = WORKERS_AI_MODELS.filter(model => {
    if (requirements.tools && !model.supportsTools) return false;
    if (requirements.json && !model.supportsJSON) return false;
    if (requirements.complexity && model.complexity !== requirements.complexity) return false;
    return true;
  });

  // If no exact match, relax constraints
  if (candidates.length === 0) {
    candidates = WORKERS_AI_MODELS.filter(model => {
      if (requirements.tools && !model.supportsTools) return false;
      if (requirements.json && !model.supportsJSON) return false;
      return true;
    });
  }

  // Still no match? Return most capable model
  if (candidates.length === 0) {
    return WORKERS_AI_MODELS.find(m => m.complexity === 'powerful') || WORKERS_AI_MODELS[0];
  }

  // Prefer more powerful models for tools/JSON
  if (requirements.tools || requirements.json) {
    return candidates.sort((a, b) => {
      const complexityOrder = { fast: 0, balanced: 1, powerful: 2 };
      return complexityOrder[b.complexity] - complexityOrder[a.complexity];
    })[0];
  }

  // Default: return first match
  return candidates[0];
}

/**
 * Generate SHA-256 hash of a string for caching
 */
async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Analyze prompt complexity using a fast triage model with KV caching
 */
async function analyzeComplexity(messages: Message[], env: Env): Promise<'low' | 'high'> {
  const prompt = messages.map(m => m.content).join('\n');

  // Generate cache key from prompt hash
  const promptHash = await hashString(prompt);
  const cacheKey = `complexity:${promptHash}`;

  // Check cache first
  try {
    const cached = await env.SETTINGS_KV.get(cacheKey);
    if (cached === 'low' || cached === 'high') {
      console.log(`Complexity cache hit for hash ${promptHash}: ${cached}`);
      return cached;
    }
  } catch (error) {
    console.error('Cache lookup failed:', error);
  }

  const triagePrompt = `Analyze the complexity of this user request. Consider:
- Does it require advanced reasoning or multi-step logic?
- Does it involve complex domain knowledge?
- Is it a simple factual question or basic task?

User request:
---
${prompt}
---

Respond with ONLY: "low" or "high"`;

  try {
    const result = await generateText(
      env.AI,
      '@cf/meta/llama-3.1-8b-instruct',
      triagePrompt,
      { max_tokens: 10, temperature: 0.1 }
    );

    const complexity = result.toLowerCase().includes('high') ? 'high' : 'low';

    // Store in cache (TTL: 7 days)
    try {
      await env.SETTINGS_KV.put(cacheKey, complexity, { expirationTtl: 604800 });
      console.log(`Cached complexity for hash ${promptHash}: ${complexity}`);
    } catch (error) {
      console.error('Cache storage failed:', error);
    }

    return complexity;
  } catch (error) {
    // If triage fails, assume high complexity to be safe
    console.error('Complexity analysis failed:', error);
    return 'high';
  }
}

/**
 * Main handler for Workers AI requests
 */
export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  let selectedModel: ModelCapabilities;
  let routingReason: string;

  // Step 1: Check if user specified a specific model
  if (request.model.startsWith('@cf/')) {
    const modelCaps = getModelCapabilities(request.model);
    if (!modelCaps) {
      throw new Error(`Unknown Workers AI model: ${request.model}`);
    }
    selectedModel = modelCaps;
    routingReason = 'User-specified model';
  } else {
    // Step 2: Intelligent routing for generic "workers-ai" requests

    // A. Feature-Based Routing (Highest Priority)
    if (request.tools && request.tools.length > 0) {
      // User needs tool/function calling
      selectedModel = findModelForFeatures({ tools: true, complexity: 'powerful' });
      routingReason = 'Feature-based: Tools required';
    } else if (request.response_format && (request.response_format as any).type === 'json_object') {
      // User needs JSON output
      selectedModel = findModelForFeatures({ json: true });
      routingReason = 'Feature-based: JSON output required';
    } else {
      // B. Complexity-Based Routing (Fallback)
      const complexity = await analyzeComplexity(request.messages, env);

      if (complexity === 'high') {
        selectedModel = findModelForFeatures({ complexity: 'powerful' });
        routingReason = 'Complexity-based: High complexity detected';
      } else {
        selectedModel = findModelForFeatures({ complexity: 'fast' });
        routingReason = 'Complexity-based: Low complexity detected';
      }
    }
  }

  console.log(`Workers AI Router: Selected ${selectedModel.name} (${routingReason})`);

  // Step 3: Execute the request with the selected model
  if (request.tools && request.tools.length > 0) {
    return handleToolRequest(request, selectedModel, env, stream);
  }

  if (request.response_format && (request.response_format as any).type === 'json_object') {
    return handleJSONRequest(request, selectedModel, env);
  }

  return handleTextRequest(request, selectedModel, env, stream);
}

/**
 * Handle tool/function calling requests
 */
async function handleToolRequest(
  request: ChatCompletionRequest,
  model: ModelCapabilities,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse> {
  if (!model.supportsTools) {
    throw new Error(`Model ${model.id} does not support tool calling`);
  }

  // Convert OpenAI tool format to Workers AI format
  const prompt = buildToolPrompt(request.messages, request.tools || []);

  const result = await generateText(env.AI, model.id, prompt, {
    max_tokens: request.max_tokens || 2048,
    temperature: request.temperature || 0.7,
  });

  // Parse tool calls from response
  const toolCalls = extractToolCalls(result);

  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model.id,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: toolCalls.length > 0 ? null : result,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      },
    ],
    usage: {
      prompt_tokens: estimateTokens(prompt),
      completion_tokens: estimateTokens(result),
      total_tokens: estimateTokens(prompt) + estimateTokens(result),
    },
  };
}

/**
 * Handle JSON output requests
 */
async function handleJSONRequest(
  request: ChatCompletionRequest,
  model: ModelCapabilities,
  env: Env
): Promise<ChatCompletionResponse> {
  if (!model.supportsJSON) {
    throw new Error(`Model ${model.id} does not support JSON output`);
  }

  const prompt = buildJSONPrompt(request.messages);

  const result = await generateText(env.AI, model.id, prompt, {
    max_tokens: request.max_tokens || 2048,
    temperature: request.temperature || 0.7,
  });

  // Clean and validate JSON
  const jsonResult = cleanJSON(result);

  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model.id,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: jsonResult,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: estimateTokens(prompt),
      completion_tokens: estimateTokens(result),
      total_tokens: estimateTokens(prompt) + estimateTokens(result),
    },
  };
}

/**
 * Create streaming response in OpenAI-compatible SSE format
 */
async function createStreamingResponse(
  request: ChatCompletionRequest,
  model: ModelCapabilities,
  env: Env,
  prompt: string
): Promise<ReadableStream> {
  const workersAiStream = await generateTextStream(env.AI, model.id, prompt, {
    max_tokens: request.max_tokens || 2048,
    temperature: request.temperature || 0.7,
  });

  return new ReadableStream({
    async start(controller) {
      try {
        const reader = workersAiStream.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          // Decode the chunk from Workers AI
          const text = decoder.decode(value, { stream: true });

          // Workers AI streams in chunks, we need to extract the text
          // The format varies, but typically it's JSON with a 'response' or 'text' field
          let chunkText = '';
          try {
            const parsed = JSON.parse(text);
            chunkText = parsed.response || parsed.text || '';
          } catch {
            // If not JSON, use the raw text
            chunkText = text;
          }

          if (chunkText) {
            // Convert to OpenAI-compatible SSE format
            const openaiChunk = {
              id: `chatcmpl-${crypto.randomUUID()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: model.id,
              choices: [
                {
                  index: 0,
                  delta: { content: chunkText },
                  finish_reason: null,
                },
              ],
            };

            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
            );
          }
        }

        // Send final chunk
        const finalChunk = {
          id: `chatcmpl-${crypto.randomUUID()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: model.id,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: 'stop',
            },
          ],
        };

        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(finalChunk)}\n\n`)
        );
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

/**
 * Handle standard text generation requests
 */
async function handleTextRequest(
  request: ChatCompletionRequest,
  model: ModelCapabilities,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  const prompt = buildPrompt(request.messages);

  if (stream) {
    if (!model.supportsStreaming) {
      throw new Error(`Model ${model.id} does not support streaming. Please use stream: false.`);
    }
    return createStreamingResponse(request, model, env, prompt);
  }

  const result = await generateText(env.AI, model.id, prompt, {
    max_tokens: request.max_tokens || 2048,
    temperature: request.temperature || 0.7,
  });

  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model.id,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: estimateTokens(prompt),
      completion_tokens: estimateTokens(result),
      total_tokens: estimateTokens(prompt) + estimateTokens(result),
    },
  };
}

/**
 * Build prompt from messages
 */
function buildPrompt(messages: Message[]): string {
  return messages
    .map(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}: ${msg.content}`;
    })
    .join('\n\n');
}

/**
 * Build prompt for tool calling
 */
function buildToolPrompt(messages: Message[], tools: any[]): string {
  const toolsDesc = tools.map(t => `- ${t.function.name}: ${t.function.description}`).join('\n');

  const systemPrompt = `You have access to the following tools:
${toolsDesc}

To use a tool, respond with JSON in this format:
{"tool": "tool_name", "arguments": {...}}

If you don't need a tool, respond normally.`;

  const conversationPrompt = messages
    .map(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}: ${msg.content}`;
    })
    .join('\n\n');

  return `${systemPrompt}\n\n${conversationPrompt}\n\nAssistant:`;
}

/**
 * Build prompt for JSON output
 */
function buildJSONPrompt(messages: Message[]): string {
  const systemPrompt = 'You must respond with valid JSON only. Do not include any text outside the JSON object.';

  const conversationPrompt = messages
    .map(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      return `${role}: ${msg.content}`;
    })
    .join('\n\n');

  return `${systemPrompt}\n\n${conversationPrompt}\n\nAssistant (JSON only):`;
}

/**
 * Extract tool calls from LLM response
 */
function extractToolCalls(text: string): any[] {
  try {
    // Look for JSON objects in the response
    const jsonMatch = text.match(/\{[^{}]*"tool"[^{}]*\}/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.tool && parsed.arguments) {
      return [
        {
          id: `call_${crypto.randomUUID()}`,
          type: 'function',
          function: {
            name: parsed.tool,
            arguments: JSON.stringify(parsed.arguments),
          },
        },
      ];
    }
  } catch {
    // Not a tool call
  }

  return [];
}

/**
 * Clean and extract JSON from LLM response
 * SECURITY FIX: More reliable JSON extraction than aggressive regex
 */
function cleanJSON(text: string): string {
  // Find the first { or [ and the last } or ]
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const lastBrace = text.lastIndexOf('}');
  const lastBracket = text.lastIndexOf(']');

  let start = -1;
  let end = -1;

  // Determine which delimiter appears first
  if (firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = lastBrace + 1;
  } else if (firstBracket >= 0) {
    start = firstBracket;
    end = lastBracket + 1;
  }

  if (start >= 0 && end > start) {
    const extracted = text.substring(start, end);
    try {
      // Validate it's actually JSON
      JSON.parse(extracted);
      return extracted;
    } catch {
      // Fall through to return original
    }
  }

  return text;
}

/**
 * Estimate token count (rough approximation)
 */
function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}
