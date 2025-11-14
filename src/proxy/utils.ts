/**
 * Shared utility functions for proxy handlers
 * @module proxy/utils
 */

/**
 * Convert Vercel AI SDK stream to OpenAI-compatible SSE format
 *
 * This function transforms a text stream from the Vercel AI SDK into
 * the OpenAI streaming format (Server-Sent Events with JSON chunks).
 *
 * @param textStream - The async iterable text stream from Vercel AI SDK
 * @param modelName - The model name to include in the SSE chunks
 * @returns ReadableStream in OpenAI-compatible SSE format
 */
export async function createSSEStream(textStream: any, modelName: string): Promise<ReadableStream> {
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
