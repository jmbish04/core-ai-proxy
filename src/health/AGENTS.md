# Health & Testing Subsystem - AGENTS.md

## Purpose
Provides automated health checks and testing capabilities for the core-ai-proxy. Tests are defined statically, executed on-demand or via cron, and results are stored in D1 for historical analysis.

## Architecture

### Files
- **definitions.ts**: Static array of test definitions
- **runner.ts**: Test execution engine

### API Endpoints (in src/api.ts)
- `GET /api/health`: High-level system status
- `GET /api/tests/defs`: List all test definitions
- `POST /api/tests/run`: Execute all tests on-demand
- `GET /api/tests/session/:id`: Retrieve specific test run results

## Test Definition Structure

```typescript
interface TestDefinition {
  id: string; // e.g., 'check-openai-proxy'
  description: string;
  endpoint: string; // e.g., '/api/v1/chat/completions'
  payload: unknown; // Request body
  expected_status: number; // HTTP status code
}
```

## Test Execution Flow

1. **Trigger**: Cron schedule (every 15 minutes) or manual POST request
2. **Runner**: Iterates through all test definitions
3. **Execution**: Makes internal fetch to test endpoints
4. **Validation**: Compares response status to expected_status
5. **Storage**: Writes results to `test_runs` table in D1
6. **Health Status**: Latest test results determine overall health

## Example Tests

```typescript
export const TEST_DEFINITIONS: TestDefinition[] = [
  {
    id: 'check-openai-proxy',
    description: 'Test OpenAI proxy with GPT-4',
    endpoint: '/api/v1/chat/completions',
    payload: {
      model: 'gpt-4',
      messages: [{ role: 'user', content: 'Say "OK"' }],
      max_tokens: 5,
    },
    expected_status: 200,
  },
  {
    id: 'check-workers-ai',
    description: 'Test Workers AI with Llama',
    endpoint: '/api/v1/chat/completions',
    payload: {
      model: '@cf/meta/llama-3-8b-instruct',
      messages: [{ role: 'user', content: 'Respond with OK' }],
      max_tokens: 5,
    },
    expected_status: 200,
  },
];
```

## Frontend Integration

The `health.html` page connects to these endpoints to:
- Display real-time test execution
- Show historical test results
- Visualize system health trends

## Maintenance Guidelines

1. **Add Tests**: Append to TEST_DEFINITIONS array in definitions.ts
2. **Cron Schedule**: Modify triggers in wrangler.toml
3. **Test Coverage**: Ensure all critical endpoints have tests
4. **Timeout Handling**: Consider adding timeout logic to runner.ts

## Dependencies
- Database layer (test_definitions, test_runs tables)
- Kysely (for querying historical results)
- Drizzle (for inserting new test runs)
