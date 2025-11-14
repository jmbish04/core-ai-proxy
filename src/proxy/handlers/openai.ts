/**
 * OpenAI Handler - Standardized with Vercel AI SDK
 *
 * This handler uses the Vercel AI SDK for type-safe, standardized
 * interaction with OpenAI models. The SDK handles:
 * - Automatic message format conversion
 * - Streaming with proper SSE formatting
 * - Token counting and usage tracking
 * - Error handling
 *
 * @module proxy/handlers/openai
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import type { ChatCompletionRequest, ChatCompletionResponse, Env } from '../../types';

/**
 * Convert our internal message format to Vercel AI SDK format
 */
function convertMessages(messages: ChatCompletionRequest['messages']) {
  return messages.map(msg => ({
    role: msg.role as 'system' | 'user' | 'assistant',
    content: msg.content || '',
  }));
}

/**
 * Convert Vercel AI SDK stream to OpenAI-compatible SSE format
 */
async function createSSEStream(textStream: any): Promise<ReadableStream> {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of textStream) {
          const openaiChunk = {
            id: `chatcmpl-${crypto.randomUUID()}`,
            object: 'chat.completion.chunk',
            created: Math.floor(Date.now() / 1000),
            model: chunk.model || 'gpt-4',
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
          model: 'gpt-4',
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
 * Main handler for OpenAI requests
 */
export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  // Initialize OpenAI provider with Vercel AI SDK
  const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const messages = convertMessages(request.messages);

  if (stream) {
    // Use Vercel AI SDK's streamText for streaming
    const result = await streamText({
      model: openai(request.model),
      messages,
      temperature: request.temperature,
      maxTokens: request.max_tokens,
      topP: request.top_p,
    });

    // Convert to OpenAI-compatible SSE format
    return createSSEStream(result.textStream, request.model);
  }

  // Use Vercel AI SDK's generateText for non-streaming
  const result = await generateText({
    model: openai(request.model),
    messages,
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
