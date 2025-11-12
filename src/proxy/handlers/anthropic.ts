// src/proxy/handlers/anthropic.ts
// Anthropic handler with normalization to OpenAI format

import Anthropic from '@anthropic-ai/sdk';
import type { ChatCompletionRequest, ChatCompletionResponse, Message, Env } from '../../types';

export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  const client = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
  });

  // Extract system message
  const systemMessage = request.messages.find((msg) => msg.role === 'system')?.content || undefined;

  // Convert messages (exclude system)
  const messages = request.messages
    .filter((msg) => msg.role !== 'system')
    .map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content || '',
    }));

  if (stream) {
    const streamResponse = await client.messages.create({
      model: request.model,
      messages,
      system: systemMessage,
      max_tokens: request.max_tokens || 1024,
      temperature: request.temperature,
      stream: true,
    });

    return new ReadableStream({
      async start(controller) {
        try {
          for await (const event of streamResponse) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              const openaiChunk = {
                id: `chatcmpl-${crypto.randomUUID()}`,
                object: 'chat.completion.chunk',
                created: Math.floor(Date.now() / 1000),
                model: request.model,
                choices: [
                  {
                    index: 0,
                    delta: { content: event.delta.text },
                    finish_reason: null,
                  },
                ],
              };

              const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
              controller.enqueue(new TextEncoder().encode(sseData));
            }

            if (event.type === 'message_stop') {
              const finalChunk = {
                id: `chatcmpl-${crypto.randomUUID()}`,
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
            }
          }
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  // Non-streaming response
  const response = await client.messages.create({
    model: request.model,
    messages,
    system: systemMessage,
    max_tokens: request.max_tokens || 1024,
    temperature: request.temperature,
    stream: false,
  });

  const content = response.content[0];
  const text = content?.type === 'text' ? content.text : '';

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
          content: text,
        },
        finish_reason: response.stop_reason === 'end_turn' ? 'stop' : 'length',
      },
    ],
    usage: {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    },
  };
}
