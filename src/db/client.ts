// src/db/client.ts
import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import * as schema from './schema';
import type { Database } from './types';

export interface DbClients {
  drizzle: DrizzleD1Database<typeof schema>;
  kysely: Kysely<Database>;
}

/**
 * Initialize both Drizzle and Kysely clients from the D1 binding.
 *
 * Usage:
 * ```ts
 * const { drizzle: db, kysely } = initDb(env.DB);
 *
 * // Use Drizzle for schema operations
 * await db.insert(schema.test_definitions).values({...});
 *
 * // Use Kysely for complex queries
 * const result = await kysely
 *   .selectFrom('test_runs')
 *   .where('status', '=', 'success')
 *   .selectAll()
 *   .execute();
 * ```
 */
export function initDb(d1: D1Database): DbClients {
  const drizzleClient = drizzle(d1, { schema });
  const kyselyClient = new Kysely<Database>({
    dialect: new D1Dialect({ database: d1 }),
  });

  return {
    drizzle: drizzleClient,
    kysely: kyselyClient,
  };
}
