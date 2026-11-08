import { INTERNAL_HEADERS, problem } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from './env';
import { isAppError } from './errors';
import { createHealthRoutes, SERVICE_NAME } from './routes/health';
import { createMediaRoutes } from './routes/media';

export function createMediaServiceApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.route('/', createHealthRoutes());
  app.route('/', createMediaRoutes());

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

    if (isAppError(error)) {
      return problem({
        status: error.status,
        code: error.code,
        detail: error.message,
        requestId,
        errors: error.errors,
      });
    }

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
      detail: 'Internal service error',
      requestId,
    });
  });

  return app;
}

export type MediaServiceApp = ReturnType<typeof createMediaServiceApp>;
