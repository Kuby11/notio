import { Hono } from 'hono';
import { INTERNAL_HEADERS, problem } from '@notio/contracts';
import { createAuth } from '../auth/config';
import { AUTH_BASE_PATH } from '../auth/options';
import type { AppEnv } from '../env';

/**
 * Обработчик Better Auth: регистрация, вход, выход, сессия, верификация,
 * сброс пароля и JWKS. Логику Better Auth не переписываем — маршрутизируем.
 */
export function createAuthRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.all(`${AUTH_BASE_PATH}/*`, (c) => {
    const auth = createAuth(c.env);

    return auth.handler(c.req.raw);
  });

  routes.all(`${AUTH_BASE_PATH}`, (c) => {
    const auth = createAuth(c.env);

    return auth.handler(c.req.raw);
  });

  return routes;
}

export function createAuthNotFoundResponse(c: {
  req: { method: string; path: string; header: (name: string) => string | undefined };
}): Response {
  return problem({
    status: 404,
    code: 'NOT_FOUND',
    detail: `Маршрут ${c.req.method} ${c.req.path} не найден`,
    requestId: c.req.header(INTERNAL_HEADERS.REQUEST_ID),
  });
}
