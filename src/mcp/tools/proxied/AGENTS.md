# MCP Proxied Tools - AGENTS.md

## Purpose
Proxied tools are lightweight definitions that forward requests to external MCP servers. These tools don't execute locally but provide a unified interface for remote capabilities.

## Tool Structure

Each proxied tool file must export:
```typescript
export const TOOL_NAME: string;
export const TOOL_DESCRIPTION: string;
export const PROXY_URL_ENV_KEY: string;  // Environment variable name
export const TOOL_SCHEMA: z.ZodSchema;   // Optional, for client validation
```

## Execution Flow

1. Client calls `POST /mcp/execute` with tool name and params
2. Router detects this is a proxied tool (has PROXY_URL_ENV_KEY)
3. Router reads `env[PROXY_URL_ENV_KEY]` to get external URL
4. Router forwards request to external MCP server
5. External server response is returned to client

## Current Tools

### cloudflare-docs.ts
**Purpose**: Query official Cloudflare documentation

**Configuration**: `CLOUDFLARE_DOCS_MCP_URL` in wrangler.toml

**Input Schema**:
```typescript
{
  query: string;  // Natural language question
}
```

**Output**: External MCP server response (documentation snippets)

## Adding New Proxied Tools

1. Create definition file in this directory
2. Add external MCP URL to wrangler.toml [vars]
3. Export required constants (no execute function needed)
4. Update this AGENTS.md

### Example: Adding Stripe Tool

**File: stripe-api.ts**
```typescript
export const TOOL_NAME = 'stripe-api';
export const TOOL_DESCRIPTION = 'Query Stripe API data';
export const PROXY_URL_ENV_KEY = 'STRIPE_MCP_URL';
export const TOOL_SCHEMA = z.object({
  endpoint: z.string(),
  method: z.enum(['GET', 'POST']),
});
```

**wrangler.toml**:
```toml
[vars]
STRIPE_MCP_URL = "https://mcp.stripe.com/api"
```

## Best Practices

1. **External Dependencies**: Document the external MCP server requirements
2. **Schema Validation**: Provide schemas for client-side validation
3. **Error Handling**: External errors will be passed through to client
4. **Authentication**: If external tool requires auth, add to environment
5. **Timeouts**: Consider adding timeout configuration

## Advantages of Proxied Tools

- **Scalability**: Offload heavy computation to specialized servers
- **Modularity**: Easy to add/remove external capabilities
- **Separation**: Don't bloat worker code with external logic
- **Upgrades**: External tools can be updated independently

## Dependencies
- External MCP servers (must be running and accessible)
- Environment configuration (wrangler.toml)
