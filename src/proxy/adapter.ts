// src/proxy/adapter.ts
// Main router that selects the appropriate handler based on model

import type { ChatCompletionRequest, ChatCompletionResponse, Env } from '../types';
import * as openai from './handlers/openai';
import * as anthropic from './handlers/anthropic';
import * as gemini from './handlers/gemini';
import * as workersAi from './handlers/workers-ai';

export async function routeRequest(
  request: ChatCompletionRequest,
  env: Env
): Promise<ChatCompletionResponse | ReadableStream> {
  const model = request.model;
  const stream = request.stream || false;

  // Detect provider based on model prefix
  if (model.startsWith('gpt-')) {
    return openai.handleRequest(request, env, stream);
  }

  if (model.startsWith('claude-')) {
    return anthropic.handleRequest(request, env, stream);
  }

  if (model.startsWith('gemini-')) {
    return gemini.handleRequest(request, env, stream);
  }

  if (model.startsWith('@cf/') || model === 'workers-ai') {
    return workersAi.handleRequest(request, env, stream);
  }

  throw new Error(`Unsupported model: ${model}`);
}

export function detectProvider(model: string): string {
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  if (model.startsWith('gemini-')) return 'google';
  if (model.startsWith('@cf/') || model === 'workers-ai') return 'workers-ai';
  return 'unknown';
}
