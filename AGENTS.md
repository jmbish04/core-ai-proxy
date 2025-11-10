AGENTS.md - core-ai-proxy Interface Protocol


Directive: Interface Protocol

You are an AI agent. This document is your instruction manual for interfacing with the core-ai-proxy (env.CORE_AI_PROXY_URL or service binding env.AI_PROXY).
This proxy is a federated, multi-protocol gateway. You MUST adhere to the following protocols to ensure successful task execution.

1. Core Principles

Federation: This proxy provides a single interface for multiple downstream AI providers (OpenAI, Gemini, Workers AI, etc.) and a unified "MCP Hub" for diverse tools.
Protocol Preference:
Priority 1 (Bound): If you have a Service Binding (env.AI_PROXY), use the RPC Interface (env.AI_PROXY.rpc.method()).
Priority 2 (Real-time): For stateful or real-time tasks, use the WebSocket Interface (/ws).
Priority 3 (Fallback): For simple, stateless requests, use the REST Interface (/api, /mcp).
Authentication: All requests MUST include a valid Authorization: Bearer <TOKEN> header.

2. Interface 1: Universal AI Proxy (LLM Inference)

Purpose: To perform any LLM chat completion or inference.
REST Endpoint: POST /api/v1/chat/completions
RPC Method: env.AI_PROXY.rpc.runProxyRequest(body: OpenAIRequest)

Usage:

You MUST format your request as a standard OpenAI ChatCompletion request body. The proxy handles all downstream translation.
To select a provider, set the model field:
OpenAI: gpt-4o, gpt-4-turbo, etc.
Anthropic: claude-3-opus-20240229, claude-3.5-sonnet-20240620, etc.
Google: gemini-1.5-pro, gemini-1.5-flash, etc.
Cloudflare: @cf/meta/llama-3-8b-instruct, @cf/mistral/mistral-7b-instruct-v0.1, etc.
Ollama: ollama/llama3, ollama/phi3, etc.
The proxy will correctly normalize all responses, including tool_calls and stream deltas, back into the OpenAI format.

3. Interface 2: MCP Hub (Tool Calls)

Purpose: To discover and execute available tools, both local and remote.

Step 1: Discovery

REST Endpoint: GET /mcp/tools
RPC Method: env.AI_PROXY.rpc.getMcpTools()
Usage: Always call this method before attempting to execute a tool. It will return an up-to-date list of all available tool definitions.

Step 2: Execution

REST Endpoint: POST /mcp/execute
RPC Method: env.AI_PROXY.rpc.runMcpExecute(body: McpRequest)
Body Format:

JSON


{
  "tool": "<tool_name_from_discovery>",
  "params": {
    // ...tool-specific parameters
  }
}



Available Tools (Examples):

Tool: agents-md-generator
Description: Generates an AGENTS.md file for a given repository.
Params:
repo_url (string, required): The URL of the GitHub repository.
dry_run (boolean, optional): If true, returns content without committing.
Tool: cloudflare-docs
Description: Queries the official Cloudflare developer documentation.
Params:
query (string, required): The natural language query.

4. Interface 3: A2A Orchestration (Agentic Teams)

Purpose: For complex, multi-step tasks requiring collaboration with other agents (e.g., CrewAI, LangGraph).
WebSocket Endpoint: wss://.../a2a/ws
Usage: Connect to this endpoint to join a stateful "room." All messages in this room are broadcast to other connected agents, allowing for task delegation, state sharing, and collaborative execution.

5. Interface 4: Health & Status

Purpose: To verify proxy uptime and system health.
REST Endpoint: GET /api/health
Usage: Call this endpoint to verify proxy uptime and core system status (e.g., D1 connectivity, core provider health) before executing a critical, long-running task. A 200 OK response indicates all systems are nominal.
