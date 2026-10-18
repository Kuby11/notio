import { problem } from '@notio/contracts';
import { createLogger } from '@notio/observability';
import { Hono } from 'hono';
import { configMiddleware } from './middleware/config';
import { corsMiddleware } from './middleware/cors';
import { rateLimitMiddleware } from './middleware/rate-limit';
import { requestIdMiddleware } from './middleware/request-id';
import { requestLoggingMiddleware } from './middleware/request-logging';
import { securityHeadersMiddleware } from './middleware/security-headers';
import { authenticationMiddleware, isPublicPath, requireAuthentication } from './middleware/auth';
import { createHealthApiRoutes } from './routes/health-api';
import { createHealthRoutes } from './routes/health';
import { createIndexRoutes } from './routes/index';
import { PROXY_TARGETS, proxyToService } from './routes/proxy';
import { SERVICE_NAME } from './constants';
import type { AppEnv } from './env';

export { SERVICE_NAME };

export function createGatewayApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  // Порядок middleware важен: сначала идентичность запроса, потом конфиг,
  // затем JWT, лимиты и логирование, и только после этого маршрутизация.
  app.use('*', requestIdMiddleware());
  app.use('*', configMiddleware());
  app.use('*', securityHeadersMiddleware());
  app.use('*', (c, next) => corsMiddleware(c.get('config'))(c, next));
  app.use('*', (c, next) => authenticationMiddleware(c.get('config'))(c, next));
  app.use('/api/*', (c, next) => rateLimitMiddleware(c.get('config'))(c, next));
  app.use('*', (c, next) => requestLoggingMiddleware(c.get('config'))(c, next));

  // Вход, регистрация и JWKS должны работать без токена.
  app.use('/api/*', (c, next) => {
    if (isPublicPath(c.req.path)) {
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

    // Структурный лог: внутренние детали ошибки не уходят клиенту, но остаются в логах.
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

/** Тип приложения gateway — источник end-to-end типов для Hono RPC клиента во фронтенде. */
export type GatewayAppType = ReturnType<typeof createGatewayApp>;
