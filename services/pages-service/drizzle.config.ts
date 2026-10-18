import { defineConfig } from 'drizzle-kit';

/**
 * Конфигурация drizzle-kit. Применение миграций локально идёт через
 * `wrangler d1 migrations apply ... --local`, поэтому подключение к базе
 * используется только для `generate`.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: 'file:.wrangler/state/notio-pages.sqlite',
  },
  strict: true,
  verbose: true,
});
