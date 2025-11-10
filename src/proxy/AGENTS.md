# Proxy Layer - AGENTS.md

## Purpose
The proxy layer implements a universal, OpenAI-compatible chat completion endpoint that routes requests to multiple AI providers (OpenAI, Anthropic, Google Gemini, Workers AI, Ollama) based on the model parameter.

## Architecture

### Files
- **handlers/openai.ts**: Pass-through handler for OpenAI API
- **handlers/anthropic.ts**: Normalizes Anthropic SDK to OpenAI format
- **handlers/gemini.ts**: Normalizes Google Gemini API to OpenAI format
- **handlers/workers-ai.ts**: Critical adapter for Cloudflare Workers AI
- **handlers/ollama.ts**: Simple fetch client for local Ollama instances
- **adapter.ts**: Main router that selects the appropriate handler

### Key Responsibilities

1. **Model Detection**: Parse the `model` parameter to determine provider
   - `gpt-*` → OpenAI
   - `claude-*` → Anthropic
   - `gemini-*` → Google
   - `@cf/*` → Workers AI
   - `ollama/*` → Ollama

2. **Request Normalization**: Convert OpenAI-format requests to provider-specific formats

3. **Response Normalization**: Convert all provider responses back to OpenAI format
   - Includes tool_calls, function_call, finish_reason
   - Stream chunks must follow OpenAI SSE format

4. **Streaming Support**: Handle both streaming and non-streaming requests

## Workers AI Adapter (Critical Component)

The Workers AI handler is the most complex because it must:
- Map model IDs (@cf/meta/llama-3-8b-instruct) to their specific schemas
- Convert OpenAI messages array to provider-specific format (e.g., Llama prompt string)
- Force structured JSON output for models without native tool support
- Normalize diverse response formats back to OpenAI standard

### Example Model Mappings
```typescript
const MODEL_CONFIGS = {
  '@cf/meta/llama-3-8b-instruct': {
    inputFormat: 'messages',
    supportsTools: false,
    outputKey: 'response',
  },
  '@cf/mistral/mistral-7b-instruct-v0.1': {
    inputFormat: 'prompt',
    supportsTools: false,
    outputKey: 'response',
  },
};
```

## Usage Pattern

All handlers should export a function with this signature:
```typescript
export async function handleRequest(
  request: OpenAIRequest,
  env: Env,
  stream: boolean
): Promise<OpenAIResponse | ReadableStream>
```

## Maintenance Guidelines

1. **Add New Providers**: Create a new handler file and update adapter.ts routing
2. **Tool Calls**: Ensure all handlers normalize tool_calls to OpenAI format
3. **Streaming**: Test both streaming and non-streaming modes
4. **Error Handling**: Return OpenAI-compatible error objects

## Dependencies
- openai (OpenAI SDK)
- @anthropic-ai/sdk
- @google/generative-ai
- @cloudflare/workers-types (AI binding)
