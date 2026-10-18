import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { SecondaryStorage } from 'better-auth';
import type { Bindings } from '../env';
import { createLoggingMailSender } from './mailer';
import { buildAuthOptions } from './options';

/**
 * Конфигурация только для `@better-auth/cli generate`: CLI работает в Node,
 * где нет Workers-биндингов и реальной базы. Ему нужен адаптер, чтобы
 * определить диалект и сгенерировать схему — сама база при этом не
 * используется, поэтому передаётся заглушка.
 *
 * Сгенерированная схема — единственный источник миграции notio-auth.
 */
const cliEnv = {
  ENVIRONMENT: 'development',
  SERVICE_VERSION: '0.0.0',
  BETTER_AUTH_URL: 'http://localhost:8787',
  BETTER_AUTH_SECRET: 'cli-only-secret-not-used-anywhere',
} as unknown as Bindings;

const stubDrizzle = {} as never;

const cliSecondaryStorage: SecondaryStorage = {
  get: () => undefined,
  getAndDelete: () => undefined,
  increment: () => 1,
  set: () => undefined,
  delete: () => undefined,
};

export const auth = betterAuth(
  buildAuthOptions(cliEnv, {
    database: drizzleAdapter(stubDrizzle, { provider: 'sqlite', schema: {} }),
    secondaryStorage: cliSecondaryStorage,
    mailSender: createLoggingMailSender(() => undefined),
    publicUrl: cliEnv.BETTER_AUTH_URL,
    frontendUrl: cliEnv.BETTER_AUTH_URL,
  }),
);
