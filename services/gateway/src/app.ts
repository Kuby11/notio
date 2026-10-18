import { problem } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from './env';
import { createHealthApiRoutes } from './routes/health-api';
import { createHealthRoutes } from './routes/health';
import { createIndexRoutes } from './routes/index';

export const SERVICE_NAME = 'gateway';

export function createGatewayApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.route('/', createIndexRoutes());
  app.route('/', createHealthRoutes());
  app.route('/', createHealthApiRoutes());

  app.notFound((c) =>
    problem({
      status: 404,
      code: 'NOT_FOUND',
      detail: `Маршрут ${c.req.method} ${c.req.path} не найден в ${SERVICE_NAME}`,
    }),
  );

  app.onError((error, c) => {
    // Структурный лог: внутренние детали ошибки не уходят клиенту, но остаются в логах.
    console.error(
      JSON.stringify({
        level: 'error',
        service: SERVICE_NAME,
        event: 'unhandled_error',
        path: c.req.path,
        message: error.message,
      }),
    );

    return problem({
      status: 500,
      code: 'INTERNAL_ERROR',
      detail: 'Внутренняя ошибка шлюза',
    });
  });

  return app;
}

/** Тип приложения gateway — источник end-to-end типов для Hono RPC клиента во фронтенде. */
export type GatewayAppType = ReturnType<typeof createGatewayApp>;
