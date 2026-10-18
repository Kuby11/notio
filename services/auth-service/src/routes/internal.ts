import {
  MAX_USER_PROFILES_PER_REQUEST,
  UserProfileListSchema,
  type UserProfile,
} from '@notio/contracts';
import { Hono } from 'hono';
import { createUserRepository } from '../db/user.repository';
import type { AppEnv } from '../env';

/**
 * Внутренний маршрут для других сервисов: публичные профили пользователей.
 *
 * Путь намеренно вне `/api/auth/*`: gateway проксирует этот префикс наружу,
 * а `/internal/*` доступен только через Service Binding. Иначе перебор id
 * превращался бы в публичный справочник почт всех пользователей.
 */
export const INTERNAL_USERS_PATH = '/internal/users';

export function createInternalRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get(INTERNAL_USERS_PATH, async (c) => {
    const ids = (c.req.query('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, MAX_USER_PROFILES_PER_REQUEST);

    const items = await createUserRepository(c.env).findProfilesByIds(ids);

    return c.json(UserProfileListSchema.parse({ items: items satisfies UserProfile[] }), 200);
  });

  return routes;
}
