import { env as workerEnv } from 'cloudflare:workers';
import { applyD1Migrations, type D1Migration } from 'cloudflare:test';

/**
 * Applies repository migrations to the local database before tests run.
 *
 * The test environment differs from production only by an extra binding with
 * migrations, so the only type cast here is to the wrapper over `env`.
 */
interface TestEnv {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
}

const env = workerEnv as unknown as TestEnv;

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
