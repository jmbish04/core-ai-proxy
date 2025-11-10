Comprehensive PRD for core-ai-proxy

## Project Vision
Build a production-grade Cloudflare Worker serving as a federated AI proxy and agentic platform. It will unify multiple AI providers behind a common interface and support hosted/proxied agent tools.

## Architecture Layers
- /public: Cinematic frontend
- /api: REST proxy, health, testing
- /mcp: Tool federator for local/remote tools
- /a2a: Agent-to-agent collaboration
- /ws: WebSocket for realtime ops
- /rpc: Internal service interface
- D1: DB for tests and AGENTS.md history
- AgentsDO: DO for lookup cache and previews

## Key Features
- **Frontend**: Hero landing, test results, downloads, preview
- **API**: OpenAI-style proxy to multiple providers (OpenAI, Gemini, etc.)
- **Workers AI Adapter**: Normalize I/O and enforce structured output
- **Streaming**: SSE with OpenAI-compatible format
- **Health**: Testing system with D1 storage
- **MCP**: Unified tool execution layer
- **Interfaces**: REST, WebSocket, RPC, A2A
- **Schema**: