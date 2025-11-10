1. Project Vision

To build a new, production-grade Cloudflare Worker named core-ai-proxy. This worker will serve as a multi-protocol, federated AI gateway and an agentic services platform. It will abstract the complexity of multiple AI providers, offer a "cinematic" and informative frontend, and provide a modular "MCP Hub" for executing both local and remote agentic tools, including an automated AGENTS.md documentation generator.

2. Core Architecture Layers

Layer
Function
/public/*
Cinematic frontend (Landing, Health, Downloads, Preview) served via ASSETS binding.
/api/*
REST Proxy (OpenAI-compatible) and Health/Testing endpoints.
/mcp/*
MCP Hub / Federator. Lists and executes both Hosted (local) tools and Proxied (external) tools.
/a2a/*
Agent-to-Agent Orchestration layer, designed for agentic teams (CrewAI, LangGraph).
/ws
WebSocket entrypoint for real-time proxy and MCP communication (Hibernatable DO).
/rpc
RPC entrypoint for internal service bindings from other workers.
D1 (agents_db)
Stores test runs and AGENTS.md generation history per repository.
AgentsDO
(Optional) Durable Object for caching MCP lookups and storing AGENTS.md dry-run previews.


3. Key Features by Layer


3.1. Frontend (/public/)

Service: Served from a bound ASSETS directory (no inline HTML).
index.html: Cinematic "Vibe Engineer" style hero/landing page.
health.html: Connects to /api/health and /api/tests/run. Displays test definitions and results from the D1 database.
downloads.html: Provides client code snippets (Python, etc.), refactored from the existing openai-api-worker and sharing the global style.
agents-preview.html: A dedicated page to render syntax-highlighted Markdown for AGENTS.md dry-run previews.
styles.css: A single, shared global stylesheet (gradient/glass aesthetic) for all pages.
client.js: Shared frontend logic for API calls (/api/health, /api/tests/run) and WebSocket connections.

3.2. Universal AI Proxy (/api/v1/)

Endpoint: POST /api/v1/chat/completions
Function: An OpenAI-compatible endpoint that routes requests to OpenAI, Gemini, Anthropic, Workers AI, and Ollama based on the model parameter.
SDKs: Uses native provider SDKs (openai, @google/generative-ai, @anthropic-ai/sdk) for robust integration.
Workers AI Adapter: A critical custom adapter (src/proxy/handlers/workers-ai.ts) that:
Maps model IDs (@cf/...) to their specific input/output schemas.
Normalizes OpenAI messages into the required format (e.g., Llama prompt).
Normalizes the diverse outputs back into an OpenAI choice.
Forces structured JSON/tool-use for models that don't natively support it, likely via a JSON-extraction prompt wrapper.
Streaming: Fully supports stream: true by normalizing provider-specific streams into text/event-stream (OpenAI format).
Standardization: All tool calls and responses are normalized to the OpenAI tool_calls format.

3.3. Health & Testing Subsystem (/api/health, /api/tests/)

Source: Based on the generate_standard_frontend_with_health.md specification.
Endpoints:
GET /api/health: High-level status (pulls from latest D1 test run).
GET /api/tests/defs: Lists all defined tests.
POST /api/tests/run: Triggers an on-demand test run.
GET /api/tests/session/:id: Retrieves results for a specific run.
Database: All test definitions and run results are stored in the D1 database (test_definitions, test_runs) using the Drizzle/Kysely ORM.
Automation: A cron trigger runs all tests (e.g., every 15 minutes) and updates the main /api/health status.

3.4. MCP Hub / Federator (/mcp/)

This layer federates multiple tool sources into a single, consistent API.
Endpoint GET /mcp/tools: Returns a combined list of all Hosted and Proxied tools available.
Endpoint POST /mcp/execute:
Receives a request (e.g., { "tool": "cloudflare-docs", "params": {...} }).
The MCP router (src/mcp/router.ts) determines if the tool is local or proxied.
If local, it executes the corresponding function in src/mcp/tools/local/.
If proxied, it forwards the request to the external MCP server URL defined in env.
Hosted Tools (src/mcp/tools/local/):
Example: agents-md-generator
Input: { repo_url: string, dry_run?: boolean, pr_url?: string }
Output: { agents_md: string, sources: string[], dry_run_preview_url?: string }
Logic: Uses an internal MCP client (mcpClient.ts) to read repo files (e.g., via a GitHub tool) and Workers AI (ai.ts) to synthesize the AGENTS.md file.
Proxied Tools (src/mcp/tools/proxied/):
Example: cloudflare-docs
This is a simple definition file that maps the tool name cloudflare-docs to the environment variable env.CLOUDFLARE_DOCS_MCP_URL.
The router handles the fetch request forwarding.

3.5. Multi-Protocol Entrypoints

WebSocket (/ws): A Hibernatable Durable Object (WebSocketDO) that handles real-time messages for both the AI Proxy ({ "type": "proxy", ... }) and MCP ({ "type": "mcp", ... }).
RPC (/rpc): An RpcServer class (src/rpc.ts) that exposes the core logic (e.G., runProxyRequest, runMcpExecute) to other workers via service bindings.
A2A (/a2a/): A dedicated router (REST and WS) for high-level agentic team orchestration, providing a stateful collaboration space.

4. Technical Stack & Standards

Framework: Hono
Language: TypeScript (Strict)
Database: Cloudflare D1
ORM: Drizzle (Schema/Migrations) + Kysely (Querying), as per new_worker_d1_orm_drizzle_kysley.md.
WebSockets: Durable Objects (Hibernatable API)
Validation: Zod (used for all inputs and API schemas)
OpenAPI: @asteasolutions/zod-to-openapi (dynamically generate openapi.json from Zod schemas).

5. Database Schema (agents_db)


TypeScript


// src/db/schema.ts
import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

// For the Health & Testing Subsystem
export const test_definitions = sqliteTable('test_definitions', {
  id: text('id').primaryKey(), // e.g., 'check-openai-proxy'
  description: text('description').notNull(),
  endpoint: text('endpoint').notNull(),
  payload: blob('payload', { mode: 'json' }),
  expected_status: integer('expected_status').notNull().default(200),
});

export const test_runs = sqliteTable('test_runs', {
  id: text('id').primaryKey(),
  test_definition_id: text('test_definition_id').notNull().references(() => test_definitions.id),
  status: text('status').notNull().default('running'), // 'running', 'success', 'failure'
  result: blob('result', { mode: 'json' }), // stores error message or success payload
  started_at: integer('started_at', { mode: 'timestamp' }).notNull(),
  completed_at: integer('completed_at', { mode: 'timestamp' }),
});

// For the AGENTS.md Generator
export const agent_generations = sqliteTable('agent_generations', {
  id: text('id').primaryKey(),
  repo_url: text('repo_url').notNull(),
  pr_url: text('pr_url'),
  is_dry_run: integer('is_dry_run', { mode: 'boolean' }).notNull().default(false),
  agents_md_content: text('agents_md_content').notNull(),
  sources: blob('sources', { mode: 'json' }).notNull(), // string[]
  created_at: integer('created_at', { mode: 'timestamp' }).notNull(),
});



6. Core File Structure




core-api-proxy/
├── .github/
│   └── workflows/
│       └── generate_agents_md.yml
├── public/
│   ├── index.html
│   ├── health.html
│   ├── downloads.html
│   ├── agents-preview.html
│   ├── styles.css
│   └── client.js
├── src/
│   ├── index.ts              # Main Hono entrypoint (routes to api, mcp, a2a)
│   ├── router.ts             # Hono app definition
│   ├── api.ts                # Hono routes for /api/* (proxy, health)
│   ├── mcp.ts                # Hono routes for /mcp/* (tools, execute)
│   ├── a2a.ts                # Hono routes for /a2a/* (orchestration)
│   ├── rpc.ts                # RPC server class
│   ├── websocket.ts          # WebSocketDO (Hibernatable)
│   │
│   ├── mcp/
│   │   ├── registry.ts       # Loads all tools from subdirs
│   │   ├── router.ts         # Core logic for /mcp/execute (routes to local/proxied)
│   │   └── tools/
│   │       ├── local/        # 1. HOSTED tools
│   │       │   └── agents-md-generator.ts
│   │       └── proxied/      # 2. PROXIED tools
│   │           └── cloudflare-docs.ts
│   │
│   ├── proxy/
│   │   ├── handlers/         # (openai.ts, gemini.ts, workers-ai.ts, ...)
│   │   └── adapter.ts
│   │
│   ├── health/
│   │   ├── runner.ts         # Logic for executing test definitions
│   │   └── definitions.ts    # Static list of test definitions
│   │
│   ├── db/
│   │   ├── schema.ts         # Drizzle schema (as above)
│   │   ├── client.ts         # initDb(env) for Drizzle + Kysely
│   │   └── types.ts          # Kysely <Database> interface
│   │
│   ├── utils/
│   │   ├── ai.ts             # Standardized wrapper for Workers AI
│   │   └── mcpClient.ts      # Client for calling internal/external MCP tools
│   │
│   ├── openapi.ts            # Zod schemas & dynamic OpenAPI generator
│   └── types.ts              # Zod schemas, Env type
│
├── migrations/
│   └── 0000_init.sql
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── wrangler.toml



7. Key wrangler.toml Bindings


Ini, TOML


name = "core-api-proxy"
main = "src/index.ts"
compatibility_date = "..."

# Asset binding for the frontend
[[kv_namespaces]]
binding = "ASSETS"
id = "..."
preview_id = "..."

# D1 database
[[d1_databases]]
binding = "DB"
database_name = "agents_db"
database_id = "..."

# WebSocket Durable Object
[[durable_objects.bindings]]
name = "WEBSOCKET_DO"
class_name = "WebSocketDO"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketDO"]

# Environment variables for keys and proxied MCP tools
[vars]
OPENAI_API_KEY = "..."
ANTHROPIC_API_KEY = "..."
GOOGLE_API_KEY = "..."
OLLAMA_BASE_URL = "http://..."

# URLs for proxied MCP tools
CLOUDFLARE_DOCS_MCP_URL = "https://mcp.cloudflare.com/tools/cloudflare-docs"
# (add other proxied MCP tool URLs here)

