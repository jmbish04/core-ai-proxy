// src/types.ts
// Core Zod schemas and TypeScript types for the worker

import { z } from 'zod';

// ============================================================================
// Environment
// ============================================================================

export interface Env {
  // Bindings
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  WEBSOCKET_DO: DurableObjectNamespace;
  SETTINGS_KV: KVNamespace;

  // API Keys
  OPENAI_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_API_KEY: string;

  // Provider URLs
  OLLAMA_BASE_URL?: string;

  // Proxied MCP Tool URLs
  CLOUDFLARE_DOCS_MCP_URL?: string;
  [key: string]: unknown; // Allow dynamic MCP URLs
}

// ============================================================================
// OpenAI-Compatible Schemas
// ============================================================================

export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function', 'tool']),
  content: z.string().nullable(),
  name: z.string().optional(),
  function_call: z
    .object({
      name: z.string(),
      arguments: z.string(),
    })
    .optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })
    )
    .optional(),
  tool_call_id: z.string().optional(),
});

export const ChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(MessageSchema),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  logit_bias: z.record(z.number()).optional(),
  user: z.string().optional(),
  tools: z
    .array(
      z.object({
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
          parameters: z.record(z.unknown()).optional(),
        }),
      })
    )
    .optional(),
  tool_choice: z.union([z.literal('none'), z.literal('auto'), z.object({})]).optional(),
});

export const ChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      message: MessageSchema,
      finish_reason: z.enum(['stop', 'length', 'tool_calls', 'content_filter', 'function_call']).nullable(),
    })
  ),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
});

export type Message = z.infer<typeof MessageSchema>;
export type ChatCompletionRequest = z.infer<typeof ChatCompletionRequestSchema>;
export type ChatCompletionResponse = z.infer<typeof ChatCompletionResponseSchema>;

// ============================================================================
// MCP Schemas
// ============================================================================

export const McpToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  schema: z.record(z.unknown()),
  type: z.enum(['local', 'proxied']),
});

export const McpExecuteRequestSchema = z.object({
  tool: z.string(),
  params: z.record(z.unknown()),
});

export const McpExecuteResponseSchema = z.object({
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});

export type McpToolDefinition = z.infer<typeof McpToolDefinitionSchema>;
export type McpExecuteRequest = z.infer<typeof McpExecuteRequestSchema>;
export type McpExecuteResponse = z.infer<typeof McpExecuteResponseSchema>;

// ============================================================================
// Health & Testing Schemas
// ============================================================================

export const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.number(),
  checks: z.record(
    z.object({
      status: z.enum(['pass', 'fail']),
      message: z.string().optional(),
    })
  ),
});

export const TestDefinitionSchema = z.object({
  id: z.string(),
  description: z.string(),
  endpoint: z.string(),
  payload: z.unknown().optional(),
  expected_status: z.number(),
});

export const TestRunSchema = z.object({
  id: z.string(),
  test_definition_id: z.string(),
  status: z.enum(['running', 'success', 'failure']),
  result: z.unknown().optional(),
  started_at: z.number(),
  completed_at: z.number().nullable(),
});

export type HealthStatus = z.infer<typeof HealthStatusSchema>;
export type TestDefinition = z.infer<typeof TestDefinitionSchema>;
export type TestRun = z.infer<typeof TestRunSchema>;

// ============================================================================
// A2A Schemas
// ============================================================================

export const A2AMessageSchema = z.object({
  type: z.enum(['task', 'result', 'status', 'error']),
  agent_id: z.string(),
  content: z.unknown(),
  timestamp: z.number(),
});

export type A2AMessage = z.infer<typeof A2AMessageSchema>;

// ============================================================================
// WebSocket Schemas
// ============================================================================

export const WebSocketMessageSchema = z.object({
  type: z.enum(['proxy', 'mcp', 'a2a', 'ping']),
  payload: z.unknown(),
});

export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;

// ============================================================================
// Utility Types
// ============================================================================

export interface ProxyHandler {
  handleRequest(
    request: ChatCompletionRequest,
    env: Env,
    stream: boolean
  ): Promise<ChatCompletionResponse | ReadableStream>;
}

export interface McpTool {
  TOOL_NAME: string;
  TOOL_DESCRIPTION: string;
  TOOL_SCHEMA: z.ZodSchema;
  execute?(params: unknown, env: Env): Promise<unknown>;
  PROXY_URL_ENV_KEY?: string; // For proxied tools
}
