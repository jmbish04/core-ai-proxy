// src/openapi.ts
// Dynamic OpenAPI specification generator using Zod schemas

import { extendZodWithOpenApi, OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  ChatCompletionRequestSchema,
  ChatCompletionResponseSchema,
  McpToolDefinitionSchema,
  McpExecuteRequestSchema,
  McpExecuteResponseSchema,
  HealthStatusSchema,
  TestDefinitionSchema,
  TestRunSchema,
} from './types';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

// ============================================================================
// Register Schemas
// ============================================================================

registry.register('ChatCompletionRequest', ChatCompletionRequestSchema);
registry.register('ChatCompletionResponse', ChatCompletionResponseSchema);
registry.register('McpToolDefinition', McpToolDefinitionSchema);
registry.register('McpExecuteRequest', McpExecuteRequestSchema);
registry.register('McpExecuteResponse', McpExecuteResponseSchema);
registry.register('HealthStatus', HealthStatusSchema);
registry.register('TestDefinition', TestDefinitionSchema);
registry.register('TestRun', TestRunSchema);

// ============================================================================
// Register Paths
// ============================================================================

// Universal AI Proxy
registry.registerPath({
  method: 'post',
  path: '/api/v1/chat/completions',
  summary: 'Create chat completion',
  description: 'OpenAI-compatible chat completion endpoint. Routes to OpenAI, Anthropic, Gemini, Workers AI, or Ollama based on model parameter.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ChatCompletionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Successful completion',
      content: {
        'application/json': {
          schema: ChatCompletionResponseSchema,
        },
      },
    },
  },
});

// Health Endpoints
registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Get system health status',
  description: 'Returns overall system health based on latest test runs',
  responses: {
    200: {
      description: 'Health status',
      content: {
        'application/json': {
          schema: HealthStatusSchema,
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/tests/defs',
  summary: 'List test definitions',
  description: 'Returns all defined health check tests',
  responses: {
    200: {
      description: 'Test definitions',
      content: {
        'application/json': {
          schema: z.array(TestDefinitionSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/tests/run',
  summary: 'Execute all tests',
  description: 'Triggers on-demand execution of all health tests',
  responses: {
    200: {
      description: 'Test run initiated',
      content: {
        'application/json': {
          schema: z.object({
            session_id: z.string(),
            message: z.string(),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/tests/session/{id}',
  summary: 'Get test session results',
  description: 'Retrieves results for a specific test run session',
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: 'Test run results',
      content: {
        'application/json': {
          schema: z.array(TestRunSchema),
        },
      },
    },
  },
});

// MCP Endpoints
registry.registerPath({
  method: 'get',
  path: '/mcp/tools',
  summary: 'List available MCP tools',
  description: 'Returns all available tools (both local and proxied)',
  responses: {
    200: {
      description: 'Tool definitions',
      content: {
        'application/json': {
          schema: z.array(McpToolDefinitionSchema),
        },
      },
    },
  },
});

registry.registerPath({
  method: 'post',
  path: '/mcp/execute',
  summary: 'Execute MCP tool',
  description: 'Executes a tool by name with provided parameters',
  request: {
    body: {
      content: {
        'application/json': {
          schema: McpExecuteRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Tool execution result',
      content: {
        'application/json': {
          schema: McpExecuteResponseSchema,
        },
      },
    },
  },
});

// ============================================================================
// Generate OpenAPI Document
// ============================================================================

export function generateOpenAPIDocument() {
  return registry.definitions;
}

export function getOpenAPISpec() {
  const definitions = generateOpenAPIDocument();

  return {
    openapi: '3.1.0',
    info: {
      title: 'core-ai-proxy',
      version: '1.0.0',
      description: 'Multi-protocol, federated AI gateway and agentic services platform',
    },
    servers: [
      {
        url: 'https://core-ai-proxy.workers.dev',
        description: 'Production',
      },
    ],
    components: {
      schemas: definitions,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  };
}
