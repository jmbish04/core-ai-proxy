// src/index.ts
// Main entry point for core-ai-proxy

import { createApp } from './router';
import { createApiRouter } from './api';
import { createMcpRouter } from './mcp';
import { createA2aRouter } from './a2a';
import { createSandboxRouter } from './sandbox';
import { WebSocketDO } from './websocket';
import { createRpcServer } from './rpc';
import { runAllTests } from './health/runner';
import type { Env } from './types';

// Export Durable Object
export { WebSocketDO };

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Route to appropriate handler based on path
    if (url.pathname.startsWith('/api')) {
      const apiApp = createApiRouter();
      return apiApp.fetch(request, env, ctx);
    }

    if (url.pathname.startsWith('/mcp')) {
      const mcpApp = createMcpRouter();
      return mcpApp.fetch(request, env, ctx);
    }

    if (url.pathname.startsWith('/a2a')) {
      const a2aApp = createA2aRouter();
      return a2aApp.fetch(request, env, ctx);
    }

    if (url.pathname.startsWith('/sandbox')) {
      const sandboxApp = createSandboxRouter();
      return sandboxApp.fetch(request, env, ctx);
    }

    // WebSocket upgrade
    if (url.pathname === '/ws' && request.headers.get('Upgrade') === 'websocket') {
      const id = env.WEBSOCKET_DO.idFromName('global');
      const stub = env.WEBSOCKET_DO.get(id);
      return stub.fetch(request);
    }

    // Main app (root and other routes)
    const app = createApp();
    return app.fetch(request, env, ctx);
  },

  /**
   * Scheduled handler for cron triggers
   */
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Run health tests on schedule
    const baseUrl = env.BASE_URL || 'https://core-ai-proxy.workers.dev';
    ctx.waitUntil(runAllTests(env, baseUrl));
  },

  /**
   * RPC handler for service bindings
   */
  async rpc(request: Request, env: Env): Promise<Response> {
    const rpcServer = createRpcServer(env);

    // Simple RPC routing (can be extended)
    const url = new URL(request.url);
    const method = url.pathname.slice(1); // Remove leading slash

    if (method === 'runProxyRequest') {
      const body = (await request.json()) as ChatCompletionRequest;
      const result = await rpcServer.runProxyRequest(body);

      // SECURITY FIX: Handle streaming responses properly
      // Check if result is a ReadableStream (streaming response)
      if (result instanceof ReadableStream) {
        return new Response(result, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      // Non-streaming response
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'runMcpExecute') {
      const { tool, params } = (await request.json()) as any;
      const result = await rpcServer.runMcpExecute(tool, params);
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (method === 'getMcpTools') {
      const result = await rpcServer.getMcpTools();
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not found', { status: 404 });
  },
};