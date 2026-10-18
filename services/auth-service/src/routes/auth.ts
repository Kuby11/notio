import { Hono } from 'hono';
import { INTERNAL_HEADERS, problem } from '@notio/contracts';
import { createAuth } from '../auth/config';
import { AUTH_BASE_PATH, type AuthDependencies } from '../auth/options';
import { createUserRepository } from '../db/user.repository';
import type { AppEnv } from '../env';

const SIGN_UP_PATH = `${AUTH_BASE_PATH}/sign-up/email`;

/**
 * Обработчик Better Auth: регистрация, вход, выход, сессия, верификация,
 * сброс пароля и JWKS. Логику Better Auth не переписываем — маршрутизируем.
 *
 * `dependencies` — точка подмены для тестов (перехват писем).
 */
export function createAuthRoutes(dependencies?: Partial<AuthDependencies>): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  /**
   * Регистрация с честным ответом о занятом email.
   *
   * Better Auth 1.7 отвечает 200 и возвращает пользователя, которого в базе
   * нет: вставка нарушила уникальный индекс, а ошибка не поднялась до клиента.
   * Клиент увидел бы «успех» и потерял аккаунт, поэтому проверяем занятость
   * заранее и отвечаем 409 в общем формате ошибок проекта.
   */
  routes.post(SIGN_UP_PATH, async (c) => {
    const email = await readEmail(c.req.raw);

    if (email !== null) {
      const existing = await createUserRepository(c.env).findByEmail(email);

      if (existing !== null) {
        return problem({
          status: 409,
          code: 'CONFLICT',
          detail: 'Аккаунт с такой почтой уже существует',
          requestId: c.req.header(INTERNAL_HEADERS.REQUEST_ID),
        });
      }
    }

    return createAuth(c.env, dependencies).handler(c.req.raw);
  });

  routes.all(`${AUTH_BASE_PATH}/*`, (c) => createAuth(c.env, dependencies).handler(c.req.raw));

  routes.all(AUTH_BASE_PATH, (c) => createAuth(c.env, dependencies).handler(c.req.raw));

  return routes;
}

/** Email из тела запроса; при нечитаемом теле проверку пропускаем. */
async function readEmail(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };

    return typeof body.email === 'string' ? body.email : null;
  } catch {
    return null;
  }
}
