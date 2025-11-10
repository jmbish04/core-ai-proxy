# Sandbox Tools - AGENTS.md

## Purpose
Provides sandboxed code execution and development environment capabilities using Cloudflare Sandbox SDK. Includes intelligent tool routing based on natural language prompts.

## Architecture

### Tool Modules (`tools/`)
- **RunCommandTool**: Execute shell commands
- **ExecuteCodeTool**: Run Python/JavaScript code with persistent context
- **FileOpsTool**: File system operations (read, write, delete, mkdir)
- **PreviewServiceTool**: Expose web services with public preview URLs

### ToolRouter
LLM-powered intent classification that automatically selects the appropriate tool based on user prompts.

**Example Flow:**
```typescript
User: "Plot a chart of this CSV data"
→ ToolRouter analyzes intent
→ Routes to ExecuteCodeTool
→ Executes Python with pandas/matplotlib
→ Returns output + terminal preview URL
```

## Key Features

### 1. Terminal Preview Integration
Every sandbox execution includes a `terminalPreviewUrl` linking to an interactive terminal UI:
```
https://containers.yourdomain.com/terminal/{userId}/{sessionId}
```

### 2. Persistent Code Context
ExecuteCodeTool supports maintaining state across multiple executions:
```typescript
// First execution
execute({ code: "x = 5", language: "python", context: "session-1" })

// Second execution - x is still available
execute({ code: "print(x * 2)", language: "python", context: "session-1" })
// Output: 10
```

### 3. Settings-Aware Execution
Tools respect user preferences from KV storage:
- Default language (Python/JavaScript)
- Chart library preference
- Auto-save configurations

## API Endpoints

### Execute via ToolRouter
```
POST /sandbox/execute
{
  "prompt": "Run ls -la",
  "userId": "user123"
}
```

### Settings Management
```
GET /sandbox/settings/:userId
PUT /sandbox/settings/:userId
POST /sandbox/settings/:userId/parse
```

### GitHub Integration
```
POST /sandbox/configs/save
{
  "userId": "user123",
  "configName": "my-analysis",
  "code": "...",
  "language": "python"
}
```

## Real Implementation Notes

To integrate actual Cloudflare Sandbox SDK:

1. **Install SDK**: Already added to package.json
2. **Initialize Sandbox**:
```typescript
import { createSandbox } from '@cloudflare/sandbox-sdk';

const sandbox = await createSandbox({
  apiKey: env.SANDBOX_API_KEY,
});
```

3. **Execute Commands**:
```typescript
const result = await sandbox.exec('python', ['script.py']);
```

4. **Code Context**:
```typescript
const context = await sandbox.createCodeContext('python');
await context.runCode('import pandas as pd');
```

5. **Preview Services**:
```typescript
await sandbox.spawn('python -m http.server 8000');
const url = await sandbox.expose(8000);
```

## Maintenance Guidelines

1. **Adding New Tools**: Create new file in `tools/`, export required constants and execute function
2. **Tool Fallback**: Always implement fallback classification in ToolRouter
3. **Error Handling**: Tools should return structured results even on failure
4. **Terminal Links**: Always include when userId is provided
5. **Context Cleanup**: Implement session cleanup for long-running contexts

## Dependencies
- @cloudflare/sandbox-sdk (code execution)
- utils/ai.ts (intent classification)
- settings/storage.ts (user preferences)
- github/integration.ts (config persistence)

## Security Considerations
- Sandbox execution is isolated from worker environment
- User code cannot access worker secrets or bindings
- Terminal preview URLs are scoped to user sessions
- GitHub tokens stored securely in KV, never exposed to client
