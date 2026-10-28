import { env as workerEnv } from 'cloudflare:workers';
import { applyD1Migrations, type D1Migration } from 'cloudflare:test';

interface TestEnv {
  DB: D1Database;
  TEST_MIGRATIONS: D1Migration[];
}

const env = workerEnv as unknown as TestEnv;

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
