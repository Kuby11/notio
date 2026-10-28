import { env as workerEnv } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createAuth } from '../src/auth/config';
import { buildAuthOptions } from '../src/auth/options';
import { createKvSecondaryStorage } from '../src/auth/secondary-storage';
import { createLoggingMailSender } from '../src/auth/mailer';
import type { Bindings } from '../src/env';

const env = workerEnv as Bindings;

function deps(overrides: Partial<Parameters<typeof buildAuthOptions>[1]> = {}) {
  return {
    database: undefined,
    secondaryStorage: createKvSecondaryStorage(env.RATE_LIMIT),
    mailSender: createLoggingMailSender(() => undefined),
    publicUrl: env.BETTER_AUTH_URL,
    frontendUrl: env.BETTER_AUTH_URL,
    ...overrides,
  };
}

describe('buildAuthOptions', () => {
  it('включает OAuth-провайдер только с полной парой ключей', () => {
    const withoutSecrets = buildAuthOptions(
      { ...env, GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: '' },
      deps(),
    );

    expect(withoutSecrets.socialProviders?.['github']).toBeUndefined();
  });

  it('подключает провайдера, когда заданы id и secret', () => {
    const options = buildAuthOptions(
      {
        ...env,
        GITHUB_CLIENT_ID: 'id',
        GITHUB_CLIENT_SECRET: 'secret',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      },
      deps(),
    );

    expect(options.socialProviders?.['github']).toEqual({
      clientId: 'id',
      clientSecret: 'secret',
    });
    expect(options.socialProviders?.['google']).toEqual({
      clientId: 'google-id',
      clientSecret: 'google-secret',
    });
  });

  it('доверяет своему origin и явно перечисленным', () => {
    const options = buildAuthOptions(
      { ...env, TRUSTED_ORIGINS: 'http://localhost:3000, ,https://notio.dev' },
      deps(),
    );

    expect(options.trustedOrigins).toEqual([
      'http://localhost:8787',
      'http://localhost:3000',
      'https://notio.dev',
    ]);
  });

  it('не дублирует origin, если он уже указан в списке', () => {
    const options = buildAuthOptions({ ...env, TRUSTED_ORIGINS: 'http://localhost:8787' }, deps());

    expect(options.trustedOrigins).toEqual(['http://localhost:8787']);
  });

  it('берёт лимиты из окружения, а при мусоре — из значений по умолчанию', () => {
    const configured = buildAuthOptions(
      { ...env, RATE_LIMIT_MAX_REQUESTS: '5', RATE_LIMIT_WINDOW_SECONDS: '30' },
      deps(),
    );
    const broken = buildAuthOptions(
      { ...env, RATE_LIMIT_MAX_REQUESTS: 'много', RATE_LIMIT_WINDOW_SECONDS: '' },
      deps(),
    );

    expect(configured.rateLimit?.max).toBe(5);
    expect(configured.rateLimit?.window).toBe(30);
    expect(broken.rateLimit?.max).toBe(20);
    expect(broken.rateLimit?.window).toBe(60);
  });

  it('ставит Secure-cookie только в production', () => {
    expect(
      buildAuthOptions({ ...env, ENVIRONMENT: 'production' }, deps()).advanced?.useSecureCookies,
    ).toBe(true);
    expect(
      buildAuthOptions({ ...env, ENVIRONMENT: 'development' }, deps()).advanced?.useSecureCookies,
    ).toBe(false);
  });

  it('включает самообслуживание аккаунта: смену почты и удаление', () => {
    const options = buildAuthOptions(env, deps());

    expect(options.user?.changeEmail?.enabled).toBe(true);
    expect(options.user?.deleteUser?.enabled).toBe(true);
  });

  it('пишет логи через переданный логгер', () => {
    const lines: string[] = [];
    const options = buildAuthOptions(env, deps({ log: (message) => lines.push(message) }));
    const logger = options.logger;

    logger?.log?.('error', 'что-то сломалось');

    expect(lines[0]).toContain('auth-service');
  });

  it('связывает парольный аккаунт с настроенными провайдерами по почте', () => {
    const options = buildAuthOptions(
      {
        ...env,
        GITHUB_CLIENT_ID: 'id',
        GITHUB_CLIENT_SECRET: 'secret',
        GOOGLE_CLIENT_ID: 'google-id',
        GOOGLE_CLIENT_SECRET: 'google-secret',
      },
      deps(),
    );

    // Без явного доверия вход через провайдера по уже занятой почте
    // отклоняется — пользователь видит ошибку вместо входа.
    expect(options.account?.accountLinking?.enabled).toBe(true);
    expect(options.account?.accountLinking?.trustedProviders).toEqual(['github', 'google']);
  });

  it('не доверяет провайдеру без ключей', () => {
    const options = buildAuthOptions(
      { ...env, GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '', GOOGLE_CLIENT_ID: '' },
      deps(),
    );

    expect(options.account?.accountLinking?.trustedProviders).toEqual([]);
  });

  it('возвращает ошибки аутентификации на страницу входа приложения', () => {
    const options = buildAuthOptions(env, deps({ frontendUrl: 'http://localhost:3000/' }));

    // У gateway нет UI: его /api/auth/error — тупик, из которого не вернуться.
    expect(options.onAPIError?.errorURL).toBe('http://localhost:3000/login');
  });
});

describe('createAuth', () => {
  it('переиспользует экземпляр для одного и того же окружения', () => {
    expect(createAuth(env)).toBe(createAuth(env));
  });

  it('собирает отдельный экземпляр при подмене зависимостей', () => {
    const messages: string[] = [];
    const withMail = createAuth(env, {
      mailSender: createLoggingMailSender((message) => messages.push(message)),
    });

    expect(withMail).not.toBe(createAuth(env));
    expect(messages).toEqual([]);
  });
});
