import { INTERNAL_HEADERS, problem } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv, Bindings } from './env';
import { isAppError } from './errors';
import { createDatabaseRoutes } from './routes/databases';
import { createHealthRoutes, SERVICE_NAME } from './routes/health';
import { createWorkspaceRoutes } from './routes/workspaces';
import { ARCHIVE_RETENTION_DAYS, createWorkspaceService } from './services/workspace.service';

export function createWorkspaceServiceApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.route('/', createHealthRoutes());
  app.route('/', createWorkspaceRoutes());
  app.route('/', createDatabaseRoutes());
  app.route('/', createDatabaseRoutes());

  app.notFound((c) =>
    problem({
      status: 404,
      code: 'NOT_FOUND',
      detail: `Route ${c.req.method} ${c.req.path} not found in ${SERVICE_NAME}`,
      requestId: c.req.header(INTERNAL_HEADERS.REQUEST_ID),
    }),
  );

  app.onError((error, c) => {
    const requestId = c.req.header(INTERNAL_HEADERS.REQUEST_ID);

    // Domain errors are an expected outcome of a scenario: the client gets
    // a meaningful code, not "500 internal error".
    if (isAppError(error)) {
      return problem({
        status: error.status,
        code: error.code,
        detail: error.message,
        requestId,
        errors: error.errors,
      });
    }

    // Structured log: internal error details never reach the client but stay in the logs.
    console.error(
      JSON.stringify({
        level: 'error',
        service: SERVICE_NAME,
        event: 'unhandled_error',
        requestId,
        path: c.req.path,
        message: error.message,
      }),
    );

    return problem({
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'Internal workspace service error',
      requestId,
    });
  });

  return app;
}

export type WorkspaceServiceApp = ReturnType<typeof createWorkspaceServiceApp>;

/**
 * Cron: an archived workspace is temporary — once the retention period
 * expires the row is deleted together with members and invitations
 * (ON DELETE CASCADE).
 */
export async function handleScheduled(
  env: Bindings,
  context: { waitUntil: (promise: Promise<unknown>) => void },
): Promise<void> {
  const removed = await createWorkspaceService(env).purgeExpired();

  console.log(
    JSON.stringify({
      level: 'info',
      service: SERVICE_NAME,
      event: 'archives_purged',
      removed,
      retentionDays: ARCHIVE_RETENTION_DAYS,
    }),
  );

  void context;
}
