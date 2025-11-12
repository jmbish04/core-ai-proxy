// src/proxy/handlers/gemini.ts
// Google Gemini handler with normalization to OpenAI format

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatCompletionRequest, ChatCompletionResponse, Message, Env } from '../../types';

export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  const genAI = new GoogleGenerativeAI(env.GOOGLE_API_KEY);
  const model = genAI.getGenerativeModel({ model: request.model });

  // Convert OpenAI messages to Gemini format
  const contents = convertMessagesToGemini(request.messages);

  if (stream) {
    const result = await model.generateContentStream({ contents });

    return new ReadableStream({
      async start(controller) {
        try {
          let fullText = '';
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullText += text;

            // Convert to OpenAI SSE format
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
  const result = await model.generateContent({ contents });
  const response = result.response;
  const text = response.text();

  // Convert to OpenAI format
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
      prompt_tokens: response.usageMetadata?.promptTokenCount || 0,
      completion_tokens: response.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: response.usageMetadata?.totalTokenCount || 0,
    },
  };
}

function convertMessagesToGemini(messages: Message[]) {
  return messages
    .filter((msg) => msg.role !== 'system') // System messages handled separately in Gemini
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content || '' }],
    }));
}