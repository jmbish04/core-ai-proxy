// src/mcp/tools/proxied/cloudflare-docs.ts
// Proxied tool for querying Cloudflare documentation

import { z } from 'zod';

export const TOOL_NAME = 'cloudflare-docs';
export const TOOL_DESCRIPTION = 'Query official Cloudflare developer documentation';
export const PROXY_URL_ENV_KEY = 'CLOUDFLARE_DOCS_MCP_URL';

export const TOOL_SCHEMA = z.object({
  query: z.string().min(1).describe('Natural language question about Cloudflare'),
});