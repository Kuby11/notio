import { betterAuth } from 'better-auth';
import type { Auth } from 'better-auth';
import { createAuthDatabase } from '../db/auth-db';
import type { Bindings } from '../env';
import { createLoggingMailSender } from './mailer';
import { buildAuthOptions, type AuthDependencies } from './options';
import { createKvSecondaryStorage } from './secondary-storage';

const instances = new WeakMap<Bindings, Auth>();

/**
 * Better Auth reads bindings from the request environment, so the instance is
 * created per request. Caching on the environment object removes repeated
 * option building inside one request and caches nothing between requests.
 *
 * `dependencies` is the substitution point for tests (intercepting emails).
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
      frontendUrl: env.FRONTEND_URL ?? 'http://localhost:3000',
      ...dependencies,
    }),
  ) as Auth;

  if (!dependencies) {
    instances.set(env, auth);
  }

  return auth;
}
