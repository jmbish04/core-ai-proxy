// src/utils/ai.ts
// Standardized wrapper for Cloudflare Workers AI

import { z } from 'zod';
import type { Message } from '../types';

export interface GenerateOptions {
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
}

/**
 * Generate text completion using Workers AI
 */
export async function generateText(
  ai: Ai,
  model: string,
  prompt: string | Message[],
  options: GenerateOptions = {}
): Promise<string> {
  const input = Array.isArray(prompt) ? { messages: prompt } : { prompt };

  const response = await ai.run(model, {
    ...input,
    max_tokens: options.max_tokens,
    temperature: options.temperature,
    top_p: options.top_p,
    stream: false,
  });

  // Handle different response formats
  if (typeof response === 'object' && response !== null) {
    if ('response' in response && typeof response.response === 'string') {
      return response.response;
    }
    if ('text' in response && typeof response.text === 'string') {
      return response.text;
    }
    if ('result' in response && typeof response.result === 'object' && response.result !== null) {
      if ('response' in response.result && typeof response.result.response === 'string') {
        return response.result.response;
      }
    }
  }

  throw new Error('Unexpected Workers AI response format');
}

/**
 * Generate streaming text completion
 */
export async function generateTextStream(
  ai: Ai,
  model: string,
  prompt: string | Message[],
  options: GenerateOptions = {}
): Promise<ReadableStream> {
  const input = Array.isArray(prompt) ? { messages: prompt } : { prompt };

  const response = await ai.run(model, {
    ...input,
    max_tokens: options.max_tokens,
    temperature: options.temperature,
    top_p: options.top_p,
    stream: true,
  });

  if (response instanceof ReadableStream) {
    return response;
  }

  throw new Error('Expected streaming response from Workers AI');
}

/**
 * Generate structured JSON output
 */
export async function generateJSON<T>(
  ai: Ai,
  model: string,
  prompt: string,
  schema: z.ZodSchema<T>
): Promise<T> {
  const jsonPrompt = `${prompt}\n\nRespond with valid JSON only. No explanations or markdown formatting.`;

  const response = await generateText(ai, model, jsonPrompt, {
    max_tokens: 2000,
    temperature: 0.3,
  });

  // Extract JSON from response (handle markdown code blocks)
  let jsonText = response.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1] || '';
  }

  // Remove any leading/trailing non-JSON characters
  jsonText = jsonText.replace(/^[^{[]*/, '').replace(/[^}\]]*$/, '');

  try {
    const parsed = JSON.parse(jsonText);
    return schema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a chat completion (messages format)
 */
export async function generateChat(
  ai: Ai,
  model: string,
  messages: Message[],
  options: GenerateOptions = {}
): Promise<string> {
  return generateText(ai, model, messages, options);
}

/**
 * Check if a model supports streaming
 */
export function supportsStreaming(model: string): boolean {
  // Most Workers AI models support streaming
  // Add exceptions here if needed
  return true;
}

/**
 * Get recommended settings for a model
 */
export function getModelDefaults(model: string): Partial<GenerateOptions> {
  // Llama models
  if (model.includes('llama')) {
    return {
      temperature: 0.7,
      max_tokens: 1024,
    };
  }

  // Mistral models
  if (model.includes('mistral')) {
    return {
      temperature: 0.7,
      max_tokens: 2048,
    };
  }

  // Default settings
  return {
    temperature: 0.7,
    max_tokens: 1024,
  };
}