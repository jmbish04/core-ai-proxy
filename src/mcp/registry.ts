// src/mcp/registry.ts
// Dynamically loads all MCP tool definitions

import type { McpToolDefinition, McpTool } from '../types';
import * as agentsMdGenerator from './tools/local/agents-md-generator';
import * as cloudflareDocs from './tools/proxied/cloudflare-docs';

// Import all local tools
const LOCAL_TOOLS: McpTool[] = [
  agentsMdGenerator as McpTool,
];

// Import all proxied tools
const PROXIED_TOOLS: McpTool[] = [
  cloudflareDocs as McpTool,
];

/**
 * Get all available tools (local + proxied)
 */
export function getAllTools(): McpToolDefinition[] {
  const localDefs: McpToolDefinition[] = LOCAL_TOOLS.map((tool) => ({
    name: tool.TOOL_NAME,
    description: tool.TOOL_DESCRIPTION,
    schema: tool.TOOL_SCHEMA ? tool.TOOL_SCHEMA._def : {},
    type: 'local' as const,
  }));

  const proxiedDefs: McpToolDefinition[] = PROXIED_TOOLS.map((tool) => ({
    name: tool.TOOL_NAME,
    description: tool.TOOL_DESCRIPTION,
    schema: tool.TOOL_SCHEMA ? tool.TOOL_SCHEMA._def : {},
    type: 'proxied' as const,
  }));

  return [...localDefs, ...proxiedDefs];
}

/**
 * Get a specific tool by name
 */
export function getTool(name: string): McpTool | null {
  const allTools = [...LOCAL_TOOLS, ...PROXIED_TOOLS];
  return allTools.find((tool) => tool.TOOL_NAME === name) || null;
}

/**
 * Check if a tool is local (hosted) or proxied (external)
 */
export function isLocalTool(name: string): boolean {
  return LOCAL_TOOLS.some((tool) => tool.TOOL_NAME === name);
}

/**
 * Check if a tool is proxied (external)
 */
export function isProxiedTool(name: string): boolean {
  return PROXIED_TOOLS.some((tool) => tool.TOOL_NAME === name);
}