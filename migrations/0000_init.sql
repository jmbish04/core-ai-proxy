-- Migration: 0000_init
-- Initial database schema for core-ai-proxy

-- Test Definitions Table
CREATE TABLE IF NOT EXISTS test_definitions (
  id TEXT PRIMARY KEY NOT NULL,
  description TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  payload BLOB,
  expected_status INTEGER NOT NULL DEFAULT 200
);

-- Test Runs Table
CREATE TABLE IF NOT EXISTS test_runs (
  id TEXT PRIMARY KEY NOT NULL,
  test_definition_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  result BLOB,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (test_definition_id) REFERENCES test_definitions(id)
);

-- Agent Generations Table
CREATE TABLE IF NOT EXISTS agent_generations (
  id TEXT PRIMARY KEY NOT NULL,
  repo_url TEXT NOT NULL,
  pr_url TEXT,
  is_dry_run INTEGER NOT NULL DEFAULT 0,
  agents_md_content TEXT NOT NULL,
  sources BLOB NOT NULL,
  created_at INTEGER NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_test_runs_definition ON test_runs(test_definition_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_started ON test_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_generations_repo ON agent_generations(repo_url);
CREATE INDEX IF NOT EXISTS idx_agent_generations_created ON agent_generations(created_at DESC);
