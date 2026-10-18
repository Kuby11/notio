import { problem } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from './env';
import { createHealthRoutes, SERVICE_NAME } from './routes/health';

export function createPagesServiceApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.route('/', createHealthRoutes());

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
      detail: 'Внутренняя ошибка сервиса',
    });
  });

  return app;
}

export type PagesServiceApp = ReturnType<typeof createPagesServiceApp>;
