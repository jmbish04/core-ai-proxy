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
Authentication: All requests MUST include a valid Authorization: Bearer TOKEN header.

2. Interface 1: Universal AI Proxy (L