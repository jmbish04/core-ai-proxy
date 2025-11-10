// src/api.ts
// API routes for /api/* (proxy and health endpoints)

import { Hono } from 'hono';
import type { Env } from './types';
import { ChatCompletionRequestSchema } from './types';
import { routeRequest } from './proxy/adapter';
import { TEST_DEFINITIONS } from './health/definitions';
import { runAllTests, getLatestTestResults, getSessionResults } from './health/runner';
import { getOpenAPISpec } from './openapi';

export function createApiRouter() {
  const app = new Hono<{ Bindings: Env }>();

  // ============================================================================
  // AI Proxy Endpoint
  // ============================================================================

  app.post('/v1/chat/completions', async (c) => {
    try {
      const body = await c.req.json();
      const request = ChatCompletionRequestSchema.parse(body);

      const response = await routeRequest(request, c.env);

      // Handle streaming responses
      if (response instanceof ReadableStream) {
        return new Response(response, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          },
        });
      }

      return c.json(response);
    } catch (error) {
      return c.json(
        {
          error: {
            message: error instanceof Error ? error.message : 'Unknown error',
            type: 'invalid_request_error',
          },
        },
        400
      );
    }
  });

  // ============================================================================
  // Health Endpoints
  // ============================================================================

  app.get('/health', async (c) => {
    const results = await getLatestTestResults(c.env);

    const totalTests = results.length;
    const passedTests = results.filter((r: { status: string }) => r.status === 'success').length;
    const healthStatus = passedTests === totalTests ? 'healthy' : passedTests > 0 ? 'degraded' : 'unhealthy';

    return c.json({
      status: healthStatus,
      timestamp: Date.now(),
      checks: {
        total: totalTests,
        passed: passedTests,
        failed: totalTests - passedTests,
      },
    });
  });

  app.get('/tests/defs', (c) => {
    return c.json(TEST_DEFINITIONS);
  });

  app.post('/tests/run', async (c) => {
    const baseUrl = new URL(c.req.url).origin;
    const sessionId = await runAllTests(c.env, baseUrl);

    return c.json({
      session_id: sessionId,
      message: 'Test run initiated',
    });
  });

  app.get('/tests/session/:id', async (c) => {
    const sessionId = c.req.param('id');
    const results = await getSessionResults(sessionId, c.env);

    return c.json(results);
  });

  // ============================================================================
  // OpenAPI Spec
  // ============================================================================

  app.get('/openapi.json', (c) => {
    return c.json(getOpenAPISpec());
  });

  return app;
}