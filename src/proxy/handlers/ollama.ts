// src/proxy/handlers/ollama.ts
// Simple fetch client for local Ollama instances

import type { ChatCompletionRequest, ChatCompletionResponse, Env } from '../../types';

export async function handleRequest(
  request: ChatCompletionRequest,
  env: Env,
  stream: boolean
): Promise<ChatCompletionResponse | ReadableStream> {
  const ollamaUrl = env.OLLAMA_BASE_URL || 'http://localhost:11434';

  // Remove "ollama/" prefix from model name
  const model = request.model.replace(/^ollama\//, '');

  if (stream) {
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.max_tokens,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    // Convert Ollama stream to OpenAI SSE format
    return new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const ollamaChunk = JSON.parse(line);

                if (ollamaChunk.message?.content) {
                  const openaiChunk = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: request.model,
                    choices: [
                      {
                        index: 0,
                        delta: { content: ollamaChunk.message.content },
                        finish_reason: ollamaChunk.done ? 'stop' : null,
                      },
                    ],
                  };

                  const sseData = `data: ${JSON.stringify(openaiChunk)}\n\n`;
                  controller.enqueue(new TextEncoder().encode(sseData));
                }

                if (ollamaChunk.done) {
                  controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
                  controller.close();
                  return;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }

          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  // Non-streaming response
  const response = await fetch(`${ollamaUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: request.messages,
      stream: false,
      options: {
        temperature: request.temperature,
        num_predict: request.max_tokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.statusText}`);
  }

  const data = await response.json();

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
          content: data.message?.content || '',
        },
        finish_reason: 'stop',
      },
    ],
    usage: {
      prompt_tokens: data.prompt_eval_count || 0,
      completion_tokens: data.eval_count || 0,
      total_tokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
    },
  };
}
