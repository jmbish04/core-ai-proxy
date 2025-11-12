// src/mcp/router.ts
// Core MCP execution logic - routes to local or proxied handlers

import type { Env, McpExecuteResponse } from '../types';
import { getTool, isLocalTool, isProxiedTool } from './registry';
import { callExternalMcp } from '../utils/mcpClient';

/**
 * Execute an MCP tool by name
 */
export async function executeTool(
  toolName: string,
  params: unknown,
  env: Env
): Promise<McpExecuteResponse> {
  const tool = getTool(toolName);

  if (!tool) {
    return {
      success: false,
      error: `Tool not found: ${toolName}`,
    };
  }

  try {
    // Validate parameters if schema exists
    if (tool.TOOL_SCHEMA) {
      const validation = tool.TOOL_SCHEMA.safeParse(params);
      if (!validation.success) {
        return {
          success: false,
          error: `Invalid parameters: ${validation.error.message}`,
        };
      }
    }

    // Route to local or proxied execution
    if (isLocalTool(toolName)) {
      return await executeLocalTool(tool, params, env);
    } else if (isProxiedTool(toolName)) {
      return await executeProxiedTool(tool, params, env);
    }

    return {
      success: false,
      error: `Unknown tool type: ${toolName}`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Execute a local (hosted) tool
 */
async function executeLocalTool(
  tool: { execute?: (params: unknown, env: Env) => Promise<unknown>; TOOL_NAME: string },
  params: unknown,
  env: Env
): Promise<McpExecuteResponse> {
  if (!tool.execute) {
    return {
      success: false,
      error: `Tool ${tool.TOOL_NAME} does not have an execute function`,
    };
  }

  try {
    const result = await tool.execute(params, env);
    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    };
  }
}

/**
 * Execute a proxied (external) tool
 */
async function executeProxiedTool(
  tool: { PROXY_URL_ENV_KEY?: string; TOOL_NAME: string },
  params: unknown,
  env: Env
): Promise<McpExecuteResponse> {
  if (!tool.PROXY_URL_ENV_KEY) {
    return {
      success: false,
      error: `Tool ${tool.TOOL_NAME} is missing PROXY_URL_ENV_KEY`,
    };
  }

  const url = env[tool.PROXY_URL_ENV_KEY];
  if (!url || typeof url !== 'string') {
    return {
      success: false,
      error: `Environment variable ${tool.PROXY_URL_ENV_KEY} not configured`,
    };
  }

  try {
    const result = await callExternalMcp(url, tool.TOOL_NAME, params);
    return {
      success: true,
      result,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'External call failed',
    };
  }
}