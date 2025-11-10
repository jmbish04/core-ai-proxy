// src/proxy/handlers/openai.ts
// Pass-through handler for OpenAI API

import OpenAI from 'openai';
import type { ChatCompletionRequest, ChatCompletionResponse, Env } from '../../types';

export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  if (stream) {
    const streamResponse = await client.chat.completions.create({
      ...request,
      stream: true,
    });

    // Convert OpenAI stream to SSE format
    return new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamResponse) {
            const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
            controller.enqueue(new TextEncoder().encode(sseData));
          }
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  // Non-streaming response
  const response = await client.chat.completions.create({
    ...request,
    stream: false,
  });

  return response as unknown as ChatCompletionResponse;
}