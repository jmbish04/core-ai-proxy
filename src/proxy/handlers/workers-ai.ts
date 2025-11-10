// src/proxy/handlers/workers-ai.ts
// Critical adapter for Cloudflare Workers AI with model-specific normalization

import type { ChatCompletionRequest, ChatCompletionResponse, Message, Env } from '../../types';
import { generateText, generateTextStream } from '../../utils/ai';

interface ModelConfig {
  inputFormat: 'messages' | 'prompt';
  supportsTools: boolean;
  outputKey: string;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  '@cf/meta/llama-3-8b-instruct': {
    inputFormat: 'messages',
    supportsTools: false,
    outputKey: 'response',
  },
  '@cf/meta/llama-3.1-8b-instruct': {
    inputFormat: 'messages',
    supportsTools: false,
    outputKey: 'response',
  },
  '@cf/mistral/mistral-7b-instruct-v0.1': {
    inputFormat: 'prompt',
    supportsTools: false,
    outputKey: 'response',
  },
};

export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  const config = MODEL_CONFIGS[request.model] || {
    inputFormat: 'messages',
    supportsTools: false,
    outputKey: 'response',
  };

  // Convert messages to appropriate format
  const input = config.inputFormat === 'prompt'
    ? convertMessagesToPrompt(request.messages)
    : request.messages;

  if (stream) {
    const streamResponse = await generateTextStream(
      env.AI,
      request.model,
      input,
      {
        max_tokens: request.max_tokens,
        temperature: request.temperature,
      }
    );

    // Convert Workers AI stream to OpenAI SSE format
    return new ReadableStream({
      async start(controller) {
        const reader = streamResponse.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const openaiChunk = {
              id: `chatcmpl-${Date.now()}`,
              object: 'chat.completion.chunk',
              created: Math.floor(Date.now() / 1000),
              model: request.model,
              choices: [
                {
                  index: 0,
                  delta: { content: text },
                  finish_reason: null,
                },
              ],
            };

            const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
            controller.enqueue(new TextEncoder().encode(sseData));
          }

          // Final chunk
          const finalChunk = {
            id: `chatcmpl-${Date.now()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: 'stop',
              },
            ],
          };

          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  // Non-streaming response
  const text = await generateText(env.AI, request.model, input, {
    max_tokens: request.max_tokens,
    temperature: request.temperature,
  });

  // Handle tool calls if requested (force structured output)
  if (request.tools && request.tools.length > 0 && !config.supportsTools) {
    // For models without native tool support, use JSON extraction
    return handleToolCallsWithJsonExtraction(request, text, env);
  }

  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: request.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: text,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}

function convertMessagesToPrompt(messages: Message[]): string {
  return messages
    .map((msg) => {
      if (msg.role === 'system') return `System: ${msg.content}`;
      if (msg.role === 'user') return `User: ${msg.content}`;
      if (msg.role === 'assistant') return `Assistant: ${msg.content}`;
      return msg.content || '';
    })
    .join('\n\n');
}

async function handleToolCallsWithJsonExtraction(
  request: ChatCompletionRequest,
  text: string,
  env: Env
): Promise<ChatCompletionResponse> {
  // This is a simplified implementation
  // In a real scenario, you'd re-prompt the model to extract tool calls
  return {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: request.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: text,
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  };
}