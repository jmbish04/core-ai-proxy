# MCP Hub - AGENTS.md

## Purpose
The MCP (Model Context Protocol) Hub federates multiple tool sources into a unified API. It supports both **Hosted** (local) tools and **Proxied** (external) tools, providing discovery and execution endpoints.

## Architecture

### Files
- **registry.ts**: Dynamically loads all tool definitions from `tools/` subdirectories
- **router.ts**: Core execution logic, routes to local or proxied handlers
- **tools/local/**: Hosted tools (executed within this worker)
- **tools/proxied/**: Proxied tools (forwarded to external MCP servers)

### Key Endpoints (in src/mcp.ts)
- `GET /mcp/tools`: Returns combined list of all available tools
- `POST /mcp/execute`: Executes a tool by name

## Tool Types

### 1. Hosted (Local) Tools
Located in `tools/local/`. These tools execute within the worker.

**Example: agents-md-generator.ts**
```typescript
export const TOOL_NAME = 'agents-md-generator';
export const TOOL_DESCRIPTION = 'Generates AGENTS.md for a repository';
export const TOOL_SCHEMA = z.object({
  repo_url: z.string().url(),
  dry_run: z.boolean().optional(),
  pr_url: z.string().url().optional(),
});

export async function execute(params: z.infer<typeof TOOL_SCHEMA>, env: Env) {
  // Implementation uses utils/mcpClient.ts and utils/ai.ts
  // Returns { agents_md, sources, dry_run_preview_url? }
}
```

### 2. Proxied (External) Tools
Located in `tools/proxied/`. These are simple definition files that map to external MCP servers.

**Example: cloudflare-docs.ts**
```typescript
export const TOOL_NAME = 'cloudflare-docs';
export const TOOL_DESCRIPTION = 'Query Cloudflare documentation';
export const PROXY_URL_ENV_KEY = 'CLOUDFLARE_DOCS_MCP_URL';
export const TOOL_SCHEMA = z.object({
  query: z.string(),
});
```

The router.ts will automatically forward requests to `env.CLOUDFLARE_DOCS_MCP_URL`.

## Execution Flow

1. **Discovery**: Client calls `GET /mcp/tools`
2. **Registry**: Returns all tools from both local/ and proxied/
3. **Execution**: Client calls `POST /mcp/execute` with `{ tool, params }`
4. **Routing**: router.ts checks if tool is local or proxied
5. **Local**: Imports and executes the tool function directly
6. **Proxied**: Fetches `env[PROXY_URL_ENV_KEY]` and forwards request

## Tool Registration

The registry.ts file automatically discovers tools using dynamic imports:
```typescript
const localTools = import.meta.glob('./tools/local/*.ts');
const proxiedTools = import.meta.glob('./tools/proxied/*.ts');
```

## Maintenance Guidelines

1. **Add Local Tool**: Create new file in `tools/local/`, export required constants
2. **Add Proxied Tool**: Create definition file in `tools/proxied/`, add URL to wrangler.toml
3. **Tool Schema**: Always use Zod for parameter validation
4. **Error Handling**: Tools should return structured error objects
5. **Async Operations**: All tool executions are async

## Dependencies
- Zod (schema validation)
- utils/mcpClient.ts (for tools that call other MCP tools)
- utils/ai.ts (for tools that use Workers AI)
- Database layer (for tools that persist data)

## AGENTS.md Generation Tool

The `agents-md-generator` is a flagship tool that:
- Accepts a repo_url, optional pr_url, and dry_run flag
- Uses mcpClient to read repository files (likely via GitHub MCP tool)
- Analyzes codebase structure
- Uses Workers AI to synthesize an AGENTS.md file
- Stores generation in agent_generations table
- Returns preview URL if dry_run is true
