/**
 * Google Gemini Handler - Standardized with Vercel AI SDK
 *
 * This handler uses the Vercel AI SDK for type-safe, standardized
 * interaction with Google Gemini models. The SDK handles:
 * - Automatic message format conversion
 * - System message extraction
 * - Streaming with proper SSE formatting
 * - Token counting and usage tracking
 *
 * @module proxy/handlers/gemini
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, generateText } from 'ai';
import type { ChatCompletionRequest, ChatCompletionResponse, Env } from '../../types';

/**
 * Convert our internal message format to Vercel AI SDK format
 * System messages are handled separately by the SDK
 */
function convertMessages(messages: ChatCompletionRequest['messages']) {
  return messages
    .filter(msg => msg.role !== 'system')
    .map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
    }));
}

/**
 * Extract system message from messages array
 */
function extractSystemMessage(messages: ChatCompletionRequest['messages']): string | undefined {
  const systemMsg = messages.find(msg => msg.role === 'system');
  return systemMsg?.content || undefined;
}

/**
 * Convert Vercel AI SDK stream to OpenAI-compatible SSE format
 */
async function createSSEStream(textStream: any, modelName: string): Promise<ReadableStream> {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          const openaiChunk = {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: modelName,
            choices: [
              {
                index: 0,
                delta: { content: chunk.delta },
                finish_reason: null,
              },
            ],
          };

          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify(openaiChunk)}\n\n`)
          );
        }

        // Send final chunk
        const finalChunk = {
          id: `chatcmpl-${crypto.randomUUID()}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: modelName,
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
 * Main handler for Google Gemini requests
 */
export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  // Initialize Google provider with Vercel AI SDK
  const google = createGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
  });

  const messages = convertMessages(request.messages);
  const system = extractSystemMessage(request.messages);

  if (stream) {
    // Use Vercel AI SDK's streamText for streaming
    const result = await streamText({
      model: google(request.model),
      messages,
      system,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      topP: request.top_p,
    });

    // Convert to OpenAI-compatible SSE format
    return createSSEStream(result.textStream, request.model);
  }

  // Use Vercel AI SDK's generateText for non-streaming
  const result = await generateText({
    model: google(request.model),
    messages,
    system,
    temperature: request.temperature,
    maxTokens: request.max_tokens,
    topP: request.top_p,
  });

  // Convert to OpenAI format
  return {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: request.model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: result.text,
        },
        finish_reason: result.finishReason === 'stop' ? 'stop' : 'length',
      },
    ],
    usage: {
      prompt_tokens: result.usage.promptTokens,
      completion_tokens: result.usage.completionTokens,
      total_tokens: result.usage.totalTokens,
    },
  };
}
