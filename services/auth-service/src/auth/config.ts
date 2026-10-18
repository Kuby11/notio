import { betterAuth } from 'better-auth';
import type { Auth } from 'better-auth';
import { createAuthDatabase } from '../db/auth-db';
import type { Bindings } from '../env';
import { createLoggingMailSender } from './mailer';
import { buildAuthOptions, type AuthDependencies } from './options';
import { createKvSecondaryStorage } from './secondary-storage';

const instances = new WeakMap<Bindings, Auth>();

/**
 * Better Auth получает биндинги из окружения запроса, поэтому экземпляр
 * создаётся на каждый запрос. Кеш по объекту окружения убирает повторную
 * сборку опций внутри одного запроса и ничего не кеширует между запросами.
 *
 * `dependencies` — точка подмены для тестов (перехват писем).
 */
export function createAuth(env: Bindings, dependencies?: Partial<AuthDependencies>): Auth {
  const cached = instances.get(env);

  if (cached && !dependencies) {
    return cached;
  }

  const auth = betterAuth(
    buildAuthOptions(env, {
      database: createAuthDatabase(env),
      secondaryStorage: createKvSecondaryStorage(env.RATE_LIMIT),
      mailSender: createLoggingMailSender((message) => console.log(message)),
      publicUrl: env.BETTER_AUTH_URL,
      ...dependencies,
    }),
  ) as Auth;

  if (!dependencies) {
    instances.set(env, auth);
  }

  return auth;
}
