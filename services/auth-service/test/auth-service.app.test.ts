import { env as workerEnv } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createKvSecondaryStorage } from '../src/auth/secondary-storage';
import { createLoggingMailSender, createUnconfiguredMailSender } from '../src/auth/mailer';
import { requireAuthSecret, type Bindings } from '../src/env';

const env = workerEnv as Bindings;

describe('createAuthServiceApp', () => {
  it('отвечает problem+json на неизвестный маршрут', async () => {
    const { createAuthServiceApp } = await import('../src/app');

    const response = await createAuthServiceApp().request('/nope', {}, env);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/problem+json');
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('не выдаёт детали сбоя наружу, а логирует их', async () => {
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
    expect(await response.text()).not.toContain('BETTER_AUTH_SECRET не задан');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('отдаёт ответ самого Better Auth на путь без суффикса', async () => {
    const { createAuthServiceApp } = await import('../src/app');

    const response = await createAuthServiceApp().request('/api/auth', {}, env);

    // Точный путь без метода не является эндпоинтом Better Auth: отвечает 404,
    // но это ответ сервиса, а не problem+json gateway.
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).not.toBe('application/problem+json');
  });
});

describe('секрет Better Auth', () => {
  it('возвращает заданный секрет', () => {
    expect(requireAuthSecret({ ...env, BETTER_AUTH_SECRET: ' value ' })).toBe('value');
  });

  it('падает, если секрет не задан: сервис не должен стартовать вслепую', () => {
    expect(() => requireAuthSecret({ ...env, BETTER_AUTH_SECRET: '   ' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });
});

describe('MailSender', () => {
  it('в dev пишет письмо в лог, а не отправляет', async () => {
    const logs: string[] = [];
    const sender = createLoggingMailSender((message) => logs.push(message));

    await sender.send({
      to: 'user@notio.dev',
      kind: 'VERIFY_EMAIL',
      subject: 'Подтвердите почту',
      actionUrl: 'http://localhost:8787/api/auth/verify-email?token=abc',
    });

    expect(logs).toHaveLength(1);
    expect(logs[0]).toContain('VERIFY_EMAIL');
    expect(logs[0]).toContain('user@notio.dev');
  });

  it('в production без провайдера честно падает', async () => {
    await expect(
      createUnconfiguredMailSender().send({
        to: 'user@notio.dev',
        kind: 'RESET_PASSWORD',
        subject: 'Восстановление пароля',
        actionUrl: 'http://localhost:8787/reset',
      }),
    ).rejects.toThrow(/не настроена/);
  });
});

describe('вторичное хранилище на KV', () => {
  it('кладёт значения с TTL не меньше минимального для KV', async () => {
    const namespace = env.RATE_LIMIT;

    await createKvSecondaryStorage(namespace).set('cookie', 'payload', 10);

    expect(await namespace.get('auth:cookie')).toBe('payload');
    await namespace.delete('auth:cookie');
  });

  it('читает и удаляет значение вместе', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    await namespace.put('auth:ticket', 'value');
    await expect(storage.getAndDelete('ticket')).resolves.toBe('value');
    expect(await namespace.get('auth:ticket')).toBeNull();
  });

  it('считает обращения и создаёт счётчик с единицы', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    expect(await storage.increment('counter', 60)).toBe(1);
    expect(await storage.increment('counter', 60)).toBe(2);

    await namespace.delete('auth:counter');
  });

  it('удаляет значение по ключу', async () => {
    const namespace = env.RATE_LIMIT;
    const storage = createKvSecondaryStorage(namespace);

    await namespace.put('auth:temporary', 'value');
    await storage.delete('temporary');

    expect(await namespace.get('auth:temporary')).toBeNull();
  });
});
