import {
  MAX_USER_PROFILES_PER_REQUEST,
  UserProfileListSchema,
  type UserProfile,
} from '@notio/contracts';
import { Hono } from 'hono';
import { createUserRepository } from '../db/user.repository';
import type { AppEnv } from '../env';

/**
 * Internal route for other services: public user profiles.
 *
 * The path is deliberately outside `/api/auth/*`: the gateway proxies that
 * prefix outward, while `/internal/*` is reachable only through a Service
 * Binding. Otherwise enumerating ids would become a public directory of
 * every user's email.
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
