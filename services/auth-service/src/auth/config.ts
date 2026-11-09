import { betterAuth } from 'better-auth';
import type { Auth } from 'better-auth';
import { createAuthDatabase } from '../db/auth-db';
import type { Bindings } from '../env';
import { createEmailJSMailSender, createLoggingMailSender, type MailSender } from './mailer';
import { buildAuthOptions, type AuthDependencies } from './options';
import { createKvRateLimitStorage } from './rate-limit-storage';

const instances = new WeakMap<Bindings, Auth>();

/**
 * The mail transport: EmailJS when all four keys are configured, otherwise
 * the letters go to the worker log — the flow stays walkable before the
 * provider is set up.
 */
function selectMailSender(env: Bindings): MailSender {
  const serviceId = env.EMAILJS_SERVICE_ID?.trim();
  const templateId = env.EMAILJS_TEMPLATE_ID?.trim();
  const publicKey = env.EMAILJS_PUBLIC_KEY?.trim();
  const privateKey = env.EMAILJS_PRIVATE_KEY?.trim();

  if (serviceId && templateId && publicKey && privateKey) {
    return createEmailJSMailSender({ serviceId, templateId, publicKey, privateKey });
  }

  return createLoggingMailSender((message) => console.log(message));
}

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
      rateLimitStorage: createKvRateLimitStorage(env.RATE_LIMIT),
      mailSender: selectMailSender(env),
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
