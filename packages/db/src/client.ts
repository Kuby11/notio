import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';

export interface D1Binding {
  DB: D1Database;
}

export type Db<TSchema extends Record<string, unknown>> = DrizzleD1Database<TSchema>;

/**
 * Creates a Drizzle client over a D1 binding.
 *
 * The schema is passed in by the service: the shared package must not know
 * the tables of any particular service (database-per-service).
 */
export function createDb<TSchema extends Record<string, unknown>>(
  env: D1Binding,
  schema: TSchema,
): Db<TSchema> {
  return drizzle(env.DB, { schema });
}
