import { INTERNAL_HEADERS, problem } from '@notio/contracts';
import { Hono } from 'hono';
import { createAuthRoutes } from './routes/auth';
import { createHealthRoutes, SERVICE_NAME } from './routes/health';
import { createInternalRoutes } from './routes/internal';
import type { AppEnv } from './env';

export function createAuthServiceApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.route('/', createHealthRoutes());
  app.route('/', createInternalRoutes());
  app.route('/', createAuthRoutes());

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

    // Error details go to the log; the client gets anonymised problem details.
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
      detail: 'Internal authentication service error',
      requestId,
    });
  });

  return app;
}

export type AuthServiceApp = ReturnType<typeof createAuthServiceApp>;
