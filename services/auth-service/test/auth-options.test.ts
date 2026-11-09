import { env as workerEnv } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createAuth } from '../src/auth/config';
import { buildAuthOptions } from '../src/auth/options';
import { createKvRateLimitStorage } from '../src/auth/rate-limit-storage';
import { createLoggingMailSender } from '../src/auth/mailer';
import type { Bindings } from '../src/env';

const env = workerEnv as Bindings;

function deps(overrides: Partial<Parameters<typeof buildAuthOptions>[1]> = {}) {
  return {
    database: undefined,
    rateLimitStorage: createKvRateLimitStorage(env.RATE_LIMIT),
    mailSender: createLoggingMailSender(() => undefined),
    publicUrl: env.BETTER_AUTH_URL,
    frontendUrl: env.BETTER_AUTH_URL,
    ...overrides,
  };
}

describe('buildAuthOptions', () => {
  it('enables an OAuth provider only with a full pair of keys', () => {
    const withoutSecrets = buildAuthOptions(
      { ...env, GITHUB_CLIENT_ID: 'id', GITHUB_CLIENT_SECRET: '' },
      deps(),
    );

    expect(withoutSecrets.socialProviders?.['github']).toBeUndefined();
  });

  it('wires up a provider when id and secret are set', () => {
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

  it('keeps sessions in D1 and never in KV', () => {
    const options = buildAuthOptions(env, deps());

    expect(options.session?.storeSessionInDatabase).toBe(true);
    expect(options.session?.cookieCache?.enabled).toBe(false);
    // Secondary storage would make Better Auth read and write sessions in KV.
    expect(options.secondaryStorage).toBeUndefined();
    expect(options.rateLimit?.customStorage).toBeDefined();
  });

  it('trusts its own origin and explicitly listed ones', () => {
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

  it('does not duplicate an origin already present in the list', () => {
    const options = buildAuthOptions({ ...env, TRUSTED_ORIGINS: 'http://localhost:8787' }, deps());

    expect(options.trustedOrigins).toEqual(['http://localhost:8787']);
  });

  it('works without limit variables and the origin list', () => {
    const options = buildAuthOptions(
      {
        ...env,
        TRUSTED_ORIGINS: undefined,
        RATE_LIMIT_MAX_REQUESTS: undefined,
        RATE_LIMIT_WINDOW_SECONDS: undefined,
      },
      deps(),
    );

    expect(options.trustedOrigins).toEqual(['http://localhost:8787']);
    expect(options.rateLimit?.max).toBe(20);
    expect(options.rateLimit?.window).toBe(60);
  });

  it('takes limits from the environment and falls back to defaults on garbage', () => {
    const configured = buildAuthOptions(
      { ...env, RATE_LIMIT_MAX_REQUESTS: '5', RATE_LIMIT_WINDOW_SECONDS: '30' },
      deps(),
    );
    const broken = buildAuthOptions(
      { ...env, RATE_LIMIT_MAX_REQUESTS: 'not-a-number', RATE_LIMIT_WINDOW_SECONDS: '' },
      deps(),
    );

    expect(configured.rateLimit?.max).toBe(5);
    expect(configured.rateLimit?.window).toBe(30);
    expect(broken.rateLimit?.max).toBe(20);
    expect(broken.rateLimit?.window).toBe(60);
  });

  it('sets the Secure cookie only in production', () => {
    expect(
      buildAuthOptions({ ...env, ENVIRONMENT: 'production' }, deps()).advanced?.useSecureCookies,
    ).toBe(true);
    expect(
      buildAuthOptions({ ...env, ENVIRONMENT: 'development' }, deps()).advanced?.useSecureCookies,
    ).toBe(false);
  });

  it('enables account self-service: email change and deletion', () => {
    const options = buildAuthOptions(env, deps());

    expect(options.user?.changeEmail?.enabled).toBe(true);
    expect(options.user?.deleteUser?.enabled).toBe(true);
  });

  it('logs through the injected logger', () => {
    const lines: string[] = [];
    const options = buildAuthOptions(env, deps({ log: (message) => lines.push(message) }));
    const logger = options.logger;

    logger?.log?.('error', 'something broke');

    expect(lines[0]).toContain('auth-service');
  });

  it('links a password account with the configured providers by email', () => {
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

    // Without explicit trust, a provider sign-in with an already taken email
    // is refused — the user sees an error instead of signing in.
    expect(options.account?.accountLinking?.enabled).toBe(true);
    expect(options.account?.accountLinking?.trustedProviders).toEqual(['github', 'google']);
  });

  it('does not trust a provider without keys', () => {
    const options = buildAuthOptions(
      { ...env, GITHUB_CLIENT_ID: '', GITHUB_CLIENT_SECRET: '', GOOGLE_CLIENT_ID: '' },
      deps(),
    );

    expect(options.account?.accountLinking?.trustedProviders).toEqual([]);
  });

  it('sets the cookie domain only when one is configured', () => {
    const withDomain = buildAuthOptions({ ...env, COOKIE_DOMAIN: '.notio.dev' }, deps());
    const withoutDomain = buildAuthOptions({ ...env, COOKIE_DOMAIN: undefined }, deps());

    expect(withDomain.advanced?.crossSubDomainCookies).toEqual({
      enabled: true,
      domain: '.notio.dev',
    });
    expect(withoutDomain.advanced?.crossSubDomainCookies).toBeUndefined();
  });

  it('sends authentication errors back to the app login page', () => {
    const options = buildAuthOptions(env, deps({ frontendUrl: 'http://localhost:3000/' }));

    // The gateway has no UI: its /api/auth/error is a dead end with no way back.
    expect(options.onAPIError?.errorURL).toBe('http://localhost:3000/login');
  });
});

describe('createAuth', () => {
  it('reuses the instance for the same environment', () => {
    expect(createAuth(env)).toBe(createAuth(env));
  });

  it('falls back to the default frontend address when none is set', () => {
    expect(() => createAuth({ ...env, FRONTEND_URL: undefined })).not.toThrow();
  });

  it('sends mail through EmailJS when all four keys are set', () => {
    const configured = {
      ...env,
      EMAILJS_SERVICE_ID: 'service',
      EMAILJS_TEMPLATE_ID: 'template',
      EMAILJS_PUBLIC_KEY: 'public-key',
      EMAILJS_PRIVATE_KEY: 'private-key',
    };

    expect(() => createAuth(configured)).not.toThrow();
  });

  it('builds a separate instance when dependencies are swapped', () => {
    const messages: string[] = [];
    const withMail = createAuth(env, {
      mailSender: createLoggingMailSender((message) => messages.push(message)),
    });

    expect(withMail).not.toBe(createAuth(env));
    expect(messages).toEqual([]);
  });
});
