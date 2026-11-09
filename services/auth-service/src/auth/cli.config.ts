import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Bindings } from '../env';
import { createLoggingMailSender } from './mailer';
import { buildAuthOptions } from './options';
import type { RateLimitStorage } from './rate-limit-storage';

/**
 * Configuration used only by `@better-auth/cli generate`: the CLI runs in Node,
 * where there are no Workers bindings and no real database. It needs an adapter
 * to detect the dialect and generate the schema — the database itself is never
 * used, so a stub is passed in.
 *
 * The generated schema is the only source of migrations for notio-auth.
 */
const cliEnv = {
  ENVIRONMENT: 'development',
  SERVICE_VERSION: '0.0.0',
  BETTER_AUTH_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'cli-only-secret-not-used-anywhere',
} as unknown as Bindings;

const stubDrizzle = {} as never;

const cliRateLimitStorage: RateLimitStorage = {
  consume: async () => ({ allowed: true, retryAfter: null }),
};

export const auth = betterAuth(
  buildAuthOptions(cliEnv, {
    database: drizzleAdapter(stubDrizzle, { provider: 'sqlite', schema: {} }),
    rateLimitStorage: cliRateLimitStorage,
    mailSender: createLoggingMailSender(() => undefined),
    publicUrl: cliEnv.BETTER_AUTH_URL,
    frontendUrl: cliEnv.BETTER_AUTH_URL,
  }),
);
