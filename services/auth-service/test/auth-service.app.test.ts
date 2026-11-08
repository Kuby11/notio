import { env as workerEnv } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createKvSecondaryStorage } from '../src/auth/secondary-storage';
import { createLoggingMailSender, createUnconfiguredMailSender } from '../src/auth/mailer';
import { requireAuthSecret, type Bindings } from '../src/env';

const env = workerEnv as Bindings;

describe('createAuthServiceApp', () => {
  it('answers problem+json for an unknown route', async () => {
    const { createAuthServiceApp } = await import('../src/app');

    const response = await createAuthServiceApp().request('/nope', {}, env);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('serves public profiles by id through the internal route', async () => {
    const { createAuthServiceApp } = await import('../src/app');
    const userId = '00000000-0000-4000-8000-00000000000a';

    await env.DB.prepare(
      'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
    )
      .bind(userId, 'Anya', 'user@notio.dev', Date.now(), Date.now())
      .run();

    const response = await createAuthServiceApp().request(
      `/internal/users?ids=${userId},00000000-0000-4000-8000-00000000000b`,
      {},
      env,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      items: { id: string; email: string; name: string }[];
    };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: userId, email: 'user@notio.dev', name: 'Anya' });
  });

  it('serves an empty list without ids', async () => {
    const { createAuthServiceApp } = await import('../src/app');

    const response = await createAuthServiceApp().request('/internal/users?ids=', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  it('serves an empty list when the ids parameter is missing', async () => {
    const { createAuthServiceApp } = await import('../src/app');

    const response = await createAuthServiceApp().request('/internal/users', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [] });
  });

  it('does not leak failure details and logs them instead', async () => {
    const { createAuthServiceApp } = await import('../src/app');
    const errors: unknown[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => errors.push(args);

    const response = await createAuthServiceApp().request(
      '/api/auth/sign-in/email',
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' },
      { ...env, BETTER_AUTH_SECRET: '' },
    );

    console.error = originalError;

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('BETTER_AUTH_SECRET is not set');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('serves the Better Auth response on the bare path', async () => {
    const { createAuthServiceApp } = await import('../src/app');

    const response = await createAuthServiceApp().request('/api/auth', {}, env);

    // An exact path without a method is not a Better Auth endpoint: it answers 404,
    // but that is the service's answer, not the gateway's problem+json.
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).not.toBe('application/problem+json');
  });
});

describe('Better Auth secret', () => {
  it('returns the configured secret', () => {
    expect(requireAuthSecret({ ...env, BETTER_AUTH_SECRET: ' value ' })).toBe('value');
  });

  it('fails when the secret is not set: the service must not start blindly', () => {
    expect(() => requireAuthSecret({ ...env, BETTER_AUTH_SECRET: '   ' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });
});

describe('MailSender', () => {
  it('in dev writes the email to the log instead of sending it', async () => {
    const logs: string[] = [];
    const sender = createLoggingMailSender((message) => logs.push(message));

    await sender.send({
      to: 'user@notio.dev',
      kind: 'VERIFY_EMAIL',
      subject: 'Confirm your email',
      actionUrl: 'http://localhost:8787/api/auth/verify-email?token=abc',
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('VERIFY_EMAIL');
    expect(logs[0]).toContain('user@notio.dev');
  });

  it('in production fails honestly when no provider is configured', async () => {
    await expect(
      createUnconfiguredMailSender().send({
        to: 'user@notio.dev',
        kind: 'RESET_PASSWORD',
        subject: 'Password reset',
        actionUrl: 'http://localhost:8787/reset',
      }),
    ).rejects.toThrow(/not configured/);
  });
});

describe('KV secondary storage', () => {
  it('stores values with a TTL no shorter than the KV minimum', async () => {
    const namespace = env.RATE_LIMIT;

    await createKvSecondaryStorage(namespace).set('cookie', 'payload', 10);

    expect(await namespace.get('auth:cookie')).toBe('payload');
    await namespace.delete('auth:cookie');
  });

  it('reads and deletes the value together', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    await namespace.put('auth:ticket', 'value');
    await expect(storage.getAndDelete('ticket')).resolves.toBe('value');
    expect(await namespace.get('auth:ticket')).toBeNull();
  });

  it('counts calls and starts the counter at one', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    expect(await storage.increment('counter', 60)).toBe(1);
    expect(await storage.increment('counter', 60)).toBe(2);

    await namespace.delete('auth:counter');
  });

  it('deletes the value by key', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    await namespace.put('auth:temporary', 'value');
    await storage.delete('temporary');

    expect(await namespace.get('auth:temporary')).toBeNull();
  });

  it('stores a value without an explicit TTL', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    await storage.set('no-ttl', 'payload');

    expect(await namespace.get('auth:no-ttl')).toBe('payload');
    await namespace.delete('auth:no-ttl');
  });

  it('starts the counter at one when the storage holds garbage', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    await namespace.put('auth:broken-counter', 'not-a-number');

    expect(await storage.increment('broken-counter', 60)).toBe(1);

    await namespace.delete('auth:broken-counter');
  });
});
