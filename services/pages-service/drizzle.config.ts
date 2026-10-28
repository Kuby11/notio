import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration. Migrations are applied locally through
 * `wrangler d1 migrations apply ... --local`, so the database connection is
 * used only for `generate`.
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
