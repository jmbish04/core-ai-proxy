// src/mcp.ts
// MCP Hub routes for /mcp/*

import { Hono } from 'hono';
import type { Env } from './types';
import { McpExecuteRequestSchema } from './types';
import { getAllTools } from './mcp/registry';
import { executeTool } from './mcp/router';

export function createMcpRouter() {
  const app = new Hono<{ Bindings: Env }>();

  // List all available tools
  app.get('/tools', (c) => {
    const tools = getAllTools();
    return c.json(tools);
  });

  // Execute a tool
  app.post('/execute', async (c) => {
    try {
      const body = await c.req.json();
      const request = McpExecuteRequestSchema.parse(body);

      const result = await executeTool(request.tool, request.params, c.env);

      return c.json(result);
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        400
      );
    }
  });

  return app;
}