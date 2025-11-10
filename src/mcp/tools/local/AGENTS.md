# MCP Local Tools - AGENTS.md

## Purpose
Hosted tools that execute directly within the core-ai-proxy worker. These tools have full access to the worker's environment, bindings (D1, AI, etc.), and can perform complex operations.

## Tool Structure

Each tool file must export:
```typescript
export const TOOL_NAME: string;
export const TOOL_DESCRIPTION: string;
export const TOOL_SCHEMA: z.ZodSchema;
export async function execute(params: unknown, env: Env): Promise<unknown>;
```

## Current Tools

### agents-md-generator.ts
**Purpose**: Generates AGENTS.md documentation for a GitHub repository

**Input Schema**:
```typescript
{
  repo_url: string;      // GitHub repository URL
  dry_run?: boolean;     // If true, returns preview without saving
  pr_url?: string;       // Optional PR to associate with generation
}
```

**Output**:
```typescript
{
  agents_md: string;              // Generated markdown content
  sources: string[];              // List of files analyzed
  dry_run_preview_url?: string;  // URL to preview (if dry_run=true)
}
```

**Implementation Details**:
1. Calls external GitHub MCP tool to list repository files
2. Filters for relevant files (*.ts, *.md, package.json, etc.)
3. Uses Workers AI to analyze code structure
4. Synthesizes AGENTS.md using AI with specific prompt
5. Stores result in `agent_generations` table
6. If dry_run, returns preview URL pointing to `/agents-preview.html?id={generation_id}`

## Adding New Local Tools

1. Create new file in this directory (e.g., `code-reviewer.ts`)
2. Export required constants and execute function
3. Implement tool logic using env bindings as needed
4. Update this AGENTS.md with tool documentation

## Best Practices

1. **Parameter Validation**: Always use Zod schemas
2. **Error Handling**: Wrap logic in try/catch, return structured errors
3. **Async Operations**: All execute functions are async
4. **Resource Access**: Use env.DB, env.AI, env bindings for resources
5. **Idempotency**: Consider making tools idempotent where possible

## Dependencies
- utils/ai.ts (for AI inference)
- utils/mcpClient.ts (for calling other MCP tools)
- Database layer (for persistence)
- External MCP tools (GitHub, etc.)
