// src/router.ts
// Main Hono application and router

import { Hono } from 'hono';
import type { Env } from './types';

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Root endpoint
  app.get('/', (c) => {
    return c.json({
      name: 'core-ai-proxy',
      version: '1.0.0',
      description: 'Multi-protocol, federated AI gateway and agentic services platform',
      endpoints: {
        ai_proxy: '/api/v1/chat/completions',
        health: '/api/health',
        mcp_tools: '/mcp/tools',
        mcp_execute: '/mcp/execute',
        docs: '/openapi.json',
      },
    });
  });

  return app;
}