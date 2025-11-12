# Utilities - AGENTS.md

## Purpose
Shared utility functions used across the core-ai-proxy worker. These provide standardized interfaces for common operations like AI inference and MCP tool calls.

## Architecture

### Files
- **ai.ts**: Standardized wrapper for Cloudflare Workers AI
- **mcpClient.ts**: Client for calling internal/external MCP tools

## ai.ts - Workers AI Wrapper

Provides a simplified, type-safe interface to the Workers AI binding.

### Key Functions

```typescript
/**
 * Generate text completion using Workers AI
 */
export async function generateText(
  ai: Ai,
  model: string,
  prompt: string | Message[],
  options?: GenerateOptions
): Promise<string>

/**
 * Generate streaming text completion
 */
export async function generateTextStream(
  ai: Ai,
  model: string,
  prompt: string | Message[],
  options?: GenerateOptions
): Promise<ReadableStream>

/**
 * Generate structured JSON output
 */
export async function generateJSON<T>(
  ai: Ai,
  model: string,
  prompt: string,
  schema: z.ZodSchema<T>
): Promise<T>
```

### Usage Pattern
```typescript
import { generateText } from '~/utils/ai';

const result = await generateText(
  env.AI,
  '@cf/meta/llama-3-8b-instruct',
  'Explain quantum computing in one sentence',
  { max_tokens: 100 }
);
```

## mcpClient.ts - MCP Tool Client

Provides a unified client for calling both internal (local) and external (proxied) MCP tools.

### Key Functions

```typescript
/**
 * Call an MCP tool (auto-detects local vs proxied)
 */
export async function callTool<T>(
  toolName: string,
  params: unknown,
  env: Env
): Promise<T>

/**
 * List all available MCP tools
 */
export async function listTools(env: Env): Promise<ToolDefinition[]>

/**
 * Call an external MCP server directly
 */
export async function callExternalMcp<T>(
  url: string,
  toolName: string,
  params: unknown
): Promise<T>
```

### Usage Pattern
```typescript
import { callTool } from '~/utils/mcpClient';

// Used by agents-md-generator to read GitHub files
const files = await callTool<string[]>(
  'github-list-files',
  { repo: 'owner/repo', path: 'src/' },
  env
);
```

## Maintenance Guidelines

1. **AI Model Support**: Update ai.ts when new Workers AI models are released
2. **Error Handling**: Both utilities should throw structured errors
3. **Type Safety**: Use generics for return types
4. **Retries**: Consider adding retry logic for external calls in mcpClient.ts
5. **Caching**: Consider adding response caching for frequently called tools

## Dependencies
- @cloudflare/workers-types (Ai binding type)
- zod (schema validation)
- MCP registry (for tool discovery)

## Integration Points

### ai.ts is used by:
- proxy/handlers/workers-ai.ts (for OpenAI-compatible proxy)
- mcp/tools/local/agents-md-generator.ts (for AGENTS.md synthesis)
- Any custom tools that need AI inference

### mcpClient.ts is used by:
- mcp/tools/local/agents-md-generator.ts (to read repo files)
- Any tools that need to compose other tools
- Frontend (via API) for tool discovery
