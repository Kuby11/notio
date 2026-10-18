import { INTERNAL_HEADERS, problem } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from './env';
import { isAppError } from './errors';
import { createHealthRoutes, SERVICE_NAME } from './routes/health';
import { createPageRoutes } from './routes/pages';
import { createPageService } from './services/page.service';

export function createPagesServiceApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.route('/', createHealthRoutes());
  app.route('/', createPageRoutes(createPageService));

  app.notFound((c) =>
    problem({
      status: 404,
      code: 'NOT_FOUND',
      detail: `Маршрут ${c.req.method} ${c.req.path} не найден в ${SERVICE_NAME}`,
      requestId: c.req.header(INTERNAL_HEADERS.REQUEST_ID),
    }),
  );

  app.onError((error, c) => {
    const requestId = c.req.header(INTERNAL_HEADERS.REQUEST_ID);

    // Доменные ошибки — ожидаемый результат сценария: клиент получает
    // осмысленный код, а не «500 внутренняя ошибка».
    if (isAppError(error)) {
      return problem({
        status: error.status,
        code: error.code,
        detail: error.message,
        requestId,
        errors: error.errors,
      });
    }

    // Структурный лог: внутренние детали ошибки не уходят клиенту, но остаются в логах.
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
      detail: 'Внутренняя ошибка сервиса',
      requestId,
    });
  });

  return app;
}

export type PagesServiceApp = ReturnType<typeof createPagesServiceApp>;
