// src/health/runner.ts
// Test execution engine

import { initDb } from '../db/client';
import * as schema from '../db/schema';
import { TEST_DEFINITIONS } from './definitions';
import type { Env } from '../types';

export interface TestResult {
  test_id: string;
  success: boolean;
  status_code?: number;
  error?: string;
  duration_ms: number;
}

/**
 * Execute all test definitions
 */
export async function runAllTests(env: Env, baseUrl: string): Promise<string> {
  const sessionId = crypto.randomUUID();
  const { drizzle: db } = initDb(env.DB);

  // Execute tests in parallel
  const testPromises = TEST_DEFINITIONS.map((def) => runSingleTest(def, baseUrl, env));
  const results = await Promise.all(testPromises);

  // Store results in database
  const timestamp = Date.now();
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (!result) continue;

    await db.insert(schema.test_runs).values({
      id: `${sessionId}-${i}`,
      test_definition_id: result.test_id,
      status: result.success ? 'success' : 'failure',
      result: {
        status_code: result.status_code,
        error: result.error,
        duration_ms: result.duration_ms,
      },
      started_at: new Date(timestamp),
      completed_at: new Date(timestamp + result.duration_ms),
    });
  }

  return sessionId;
}

/**
 * Execute a single test
 */
async function runSingleTest(
  definition: { id: string; endpoint: string; payload?: unknown; expected_status: number },
  baseUrl: string,
  env: Env
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const url = `${baseUrl}${definition.endpoint}`;
    const options: RequestInit = {
      method: definition.payload ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (definition.payload) {
      options.body = JSON.stringify(definition.payload);
    }

    const response = await fetch(url, options);
    const duration = Date.now() - startTime;

    const success = response.status === definition.expected_status;

    return {
      test_id: definition.id,
      success,
      status_code: response.status,
      duration_ms: duration,
      error: success ? undefined : `Expected ${definition.expected_status}, got ${response.status}`,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      test_id: definition.id,
      success: false,
      duration_ms: duration,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get the latest test run results
 */
export async function getLatestTestResults(env: Env): Promise<unknown[]> {
  const { kysely } = initDb(env.DB);

  const results = await kysely
    .selectFrom('test_runs')
    .orderBy('started_at', 'desc')
    .limit(10)
    .selectAll()
    .execute();

  return results;
}

/**
 * Get test results for a specific session
 */
export async function getSessionResults(sessionId: string, env: Env): Promise<unknown[]> {
  const { kysely } = initDb(env.DB);

  const results = await kysely
    .selectFrom('test_runs')
    .where('id', 'like', `${sessionId}%`)
    .selectAll()
    .execute();

  return results;
}