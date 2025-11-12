# Database Layer - AGENTS.md

## Purpose
The database layer provides a hybrid ORM approach using Drizzle for schema management and Kysely for complex queries. This module manages all persistent data for the core-ai-proxy worker.

## Architecture

### Files
- **schema.ts**: Drizzle ORM table definitions and type inference
- **types.ts**: Kysely database interface definitions
- **client.ts**: Initialization function that returns both Drizzle and Kysely clients

### Database Tables

1. **test_definitions**: Stores health check test definitions
   - Used by the health & testing subsystem
   - Defines endpoints, expected statuses, and test payloads

2. **test_runs**: Records of executed health tests
   - Links to test_definitions via foreign key
   - Tracks status (running/success/failure) and results
   - Indexed by definition_id and started_at for performance

3. **agent_generations**: History of AGENTS.md file generations
   - Stores generated content and source files used
   - Supports dry-run previews
   - Indexed by repo_url and created_at

## Usage Patterns

### Reading with Kysely (Complex Queries)
```typescript
const { kysely } = initDb(env.DB);
const latestTests = await kysely
  .selectFrom('test_runs')
  .where('status', '=', 'success')
  .orderBy('started_at', 'desc')
  .limit(10)
  .selectAll()
  .execute();
```

### Writing with Drizzle (Schema Operations)
```typescript
const { drizzle: db } = initDb(env.DB);
await db.insert(schema.test_runs).values({
  id: crypto.randomUUID(),
  test_definition_id: 'check-openai-proxy',
  status: 'running',
  started_at: new Date(),
});
```

## Maintenance Guidelines

1. **Schema Changes**: Always create a new migration file in `/migrations`
2. **Type Safety**: Update both `schema.ts` (Drizzle) and `types.ts` (Kysely) when modifying tables
3. **Indexes**: Add indexes for columns used in WHERE clauses or ORDER BY
4. **Migrations**: Test migrations locally before deploying to production

## Dependencies
- drizzle-orm
- kysely
- kysely-d1
- @cloudflare/workers-types (D1Database type)
