// src/health/definitions.ts
// Static test definitions for health monitoring

import type { TestDefinition } from '../types';

export const TEST_DEFINITIONS: TestDefinition[] = [
  {
    id: 'check-openai-proxy',
    description: 'Test OpenAI proxy with GPT-4',
    endpoint: '/api/v1/chat/completions',
    payload: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Say "OK"' }],
      max_tokens: 5,
    },
    expected_status: 200,
  },
  {
    id: 'check-workers-ai',
    description: 'Test Workers AI with Llama',
    endpoint: '/api/v1/chat/completions',
    payload: {
      model: '@cf/meta/llama-3-8b-instruct',
      messages: [{ role: 'user', content: 'Respond with OK' }],
      max_tokens: 5,
    },
    expected_status: 200,
  },
  {
    id: 'check-anthropic-proxy',
    description: 'Test Anthropic proxy with Claude',
    endpoint: '/api/v1/chat/completions',
    payload: {
      model: 'claude-3-5-sonnet-20240620',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 5,
    },
    expected_status: 200,
  },
  {
    id: 'check-gemini-proxy',
    description: 'Test Gemini proxy',
    endpoint: '/api/v1/chat/completions',
    payload: {
      model: 'gemini-1.5-flash',
      messages: [{ role: 'user', content: 'Respond with OK' }],
      max_tokens: 5,
    },
    expected_status: 200,
  },
  {
    id: 'check-mcp-tools',
    description: 'List MCP tools',
    endpoint: '/mcp/tools',
    expected_status: 200,
  },
];