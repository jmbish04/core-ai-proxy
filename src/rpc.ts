// src/rpc.ts
// RPC server for service bindings

import type { Env, ChatCompletionRequest, ChatCompletionResponse, McpExecuteResponse } from './types';
import { routeRequest } from './proxy/adapter';
import { executeTool } from './mcp/router';
import { getAllTools } from './mcp/registry';

/**
 * RPC Server class for internal service bindings
 *
 * Usage from another worker:
 * ```ts
 * const response = await env.AI_PROXY.rpc.runProxyRequest({
 *   model: 'gpt-4',
 *   messages: [{ role: 'user', content: 'Hello' }]
 * });
 * ```
 */
export class RpcServer {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Execute a chat completion request
   */
  async runProxyRequest(
    request: ChatCompletionRequest
  ): Promise<ChatCompletionResponse | ReadableStream> {
    return await routeRequest(request, this.env);
  }

  /**
   * Execute an MCP tool
   */
  async runMcpExecute(toolName: string, params: unknown): Promise<McpExecuteResponse> {
    return await executeTool(toolName, params, this.env);
  }

  /**
   * Get all available MCP tools
   */
  async getMcpTools() {
    return getAllTools();
  }
}

/**
 * Create an RPC server instance
 */
export function createRpcServer(env: Env): RpcServer {
  return new RpcServer(env);
}