import { defineConfig } from 'drizzle-kit';

/**
 * Миграции auth-service. Схема сгенерирована официальным
 * `@better-auth/cli generate` и переиспользоваться вручную не должна.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/auth-schema.generated.ts',
  out: './migrations',
  dbCredentials: {
    url: 'file:.wrangler/state/notio-auth.sqlite',
  },
  strict: true,
  verbose: true,
});
