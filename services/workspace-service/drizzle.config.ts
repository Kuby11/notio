import { defineConfig } from 'drizzle-kit';

/** Миграции workspace-service: workspaces, workspace_members, invitations. */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './migrations',
  dbCredentials: {
    url: 'file:.wrangler/state/notio-workspace.sqlite',
  },
  strict: true,
  verbose: true,
});
