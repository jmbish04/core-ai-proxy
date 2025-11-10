// src/db/types.ts
// Kysely type definitions for the database

export interface TestDefinitionsTable {
  id: string;
  description: string;
  endpoint: string;
  payload: unknown;
  expected_status: number;
}

export interface TestRunsTable {
  id: string;
  test_definition_id: string;
  status: 'running' | 'success' | 'failure';
  result: unknown;
  started_at: number;
  completed_at: number | null;
}

export interface AgentGenerationsTable {
  id: string;
  repo_url: string;
  pr_url: string | null;
  is_dry_run: number; // SQLite boolean (0 or 1)
  agents_md_content: string;
  sources: string[]; // JSON array
  created_at: number;
}

export interface Database {
  test_definitions: TestDefinitionsTable;
  test_runs: TestRunsTable;
  agent_generations: AgentGenerationsTable;
}