import { problem } from '@notio/contracts';
import { createLogger } from '@notio/observability';
import { Hono } from 'hono';
import { configMiddleware } from './middleware/config';
import { corsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLoggingMiddleware } from './middleware/request-logging';
import { securityHeadersMiddleware } from './middleware/security-headers';
import {
  authenticationMiddleware,
  isPublicPath,
  isPublicReadPath,
  requireAuthentication,
} from './middleware/auth';
import { createHealthApiRoutes } from './routes/health-api';
import { createHealthRoutes } from './routes/health';
import { createIndexRoutes } from './routes/index';
import { PROXY_TARGETS, proxyToService } from './routes/proxy';
import { SERVICE_NAME } from './constants';
import type { AppEnv } from './env';

export { SERVICE_NAME };

export function createGatewayApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Middleware order matters: request identity first, then config,
  // then JWT, limits and logging, and only after that routing.
  app.use('*', requestIdMiddleware());
  app.use('*', configMiddleware());
  app.use('*', securityHeadersMiddleware());
  app.use('*', (c, next) => corsMiddleware(c.get('config'))(c, next));
  app.use('*', (c, next) => authenticationMiddleware(c.get('config'))(c, next));
  app.use('/api/*', (c, next) => rateLimitMiddleware(c.get('config'))(c, next));
  app.use('*', (c, next) => requestLoggingMiddleware(c.get('config'))(c, next));

  // Sign-in, registration and JWKS must work without a token; media file
  // reads are a capability URL (see isPublicReadPath).
  app.use('/api/*', (c, next) => {
    if (isPublicPath(c.req.path) || isPublicReadPath(c.req.path, c.req.method)) {
      return next();
    }

    return requireAuthentication()(c, next);
  });

  app.route('/', createIndexRoutes());
  app.route('/', createHealthRoutes());
  app.route('/', createHealthApiRoutes());

  for (const target of PROXY_TARGETS) {
    app.use(proxyToService(target));
  }

  app.notFound((c) =>
    problem({
      status: 404,
      code: 'NOT_FOUND',
      detail: `Маршрут ${c.req.method} ${c.req.path} не найден в ${SERVICE_NAME}`,
      requestId: c.get('requestId'),
    }),
  );

  app.onError((error, c) => {
    const requestId = c.get('requestId');
    const logger = createLogger({ service: SERVICE_NAME, level: c.get('config')?.logLevel });

    // Structured log: internal error details never reach the client but stay in the logs.
    logger.error('unhandled_error', { requestId, path: c.req.path, error });

    return problem({
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'Внутренняя ошибка шлюза',
      requestId,
    });
  });

  return app;
}

/** Gateway app type — the source of end-to-end types for the Hono RPC client in the frontend. */
export type GatewayAppType = ReturnType<typeof createGatewayApp>;
