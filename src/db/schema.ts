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

export type TestDefinition = typeof test_definitions.$inferSelect;
export type NewTestDefinition = typeof test_definitions.$inferInsert;
export type TestRun = typeof test_runs.$inferSelect;
export type NewTestRun = typeof test_runs.$inferInsert;
export type AgentGeneration = typeof agent_generations.$inferSelect;
export type NewAgentGeneration = typeof agent_generations.$inferInsert;
