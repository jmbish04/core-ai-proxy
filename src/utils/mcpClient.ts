// src/utils/mcpClient.ts
// Client for calling internal and external MCP tools

import type { Env, McpToolDefinition, McpExecuteResponse } from '../types';

/**
 * Call an MCP tool (auto-detects local vs proxied)
 */
export async function callTool<T = unknown>(
  toolName: string,
  params: unknown,
  env: Env
): Promise<T> {
  // This is an internal call to the MCP execute endpoint
  // In a real implementation, this would directly call the router logic
  // For now, we'll structure it as if making an internal fetch

  const response = await executeTool(toolName, params, env);

  if (!response.success) {
    throw new Error(response.error || 'Tool execution failed');
  }

  return response.result as T;
}

/**
 * Execute a tool directly (used by router and internal calls)
 */
export async function executeTool(
  toolName: string,
  params: unknown,
  env: Env
): Promise<McpExecuteResponse> {
  try {
    // Import the tool dynamically
    // This is a placeholder - actual implementation would use the MCP router
    const tools = await listTools(env);
    const tool = tools.find((t) => t.name === toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    // For now, return a placeholder response
    // Actual implementation would execute the tool
    return {
      success: true,
      result: {
        message: `Tool ${toolName} executed (placeholder implementation)`,
        params,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List all available MCP tools
 */
export async function listTools(env: Env): Promise<McpToolDefinition[]> {
  // This would normally import the registry
  // For now, return a placeholder
  return [];
}

/**
 * Call an external MCP server directly
 */
export async function callExternalMcp<T = unknown>(
  url: string,
  toolName: string,
  params: unknown
): Promise<T> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: toolName,
        params,
      }),
    });

    if (!response.ok) {
      throw new Error(`External MCP call failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    throw new Error(
      `Failed to call external MCP server: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate tool parameters against schema
 */
export function validateParams(params: unknown, schema: unknown): boolean {
  // This would use Zod validation
  // Placeholder for now
  return true;
}

/**
 * Get tool definition by name
 */
export async function getToolDefinition(
  toolName: string,
  env: Env
): Promise<McpToolDefinition | null> {
  const tools = await listTools(env);
  return tools.find((t) => t.name === toolName) || null;
}