import { env as workerEnv } from 'cloudflare:workers';
import { PROBLEM_CONTENT_TYPE } from '@notio/contracts';
import { describe, expect, it } from 'vitest';
import { createPagesServiceApp } from './app';
import type { Bindings } from './env';

const app = createPagesServiceApp();

/**
 * The environment comes from the real wrangler config, so the test also
 * verifies that the service bindings match its Bindings type.
 */
const env: Bindings = workerEnv;

describe('pages-service /health', () => {
  it('отвечает ok и описывает сам сервис', async () => {
    const response = await app.request('/health', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      services: [{ service: 'pages-service', status: 'ok' }],
    });
  });

  it('берёт версию из переменных окружения', async () => {
    const response = await app.request('/health', {}, { ...env, SERVICE_VERSION: '9.9.9' });
    const body = (await response.json()) as { version: string };

    expect(body.version).toBe('9.9.9');
  });

  it('имеет собственную базу D1 (database-per-service)', () => {
    expect(env.DB).toBeDefined();
  });
});

describe('pages-service обработка ошибок', () => {
  it('возвращает problem+json для неизвестного маршрута', async () => {
    const response = await app.request('/nope', {}, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
    expect(body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('не выдаёт детали необработанной ошибки наружу', async () => {
    const failing = createPagesServiceApp();
    failing.get('/boom', () => {
      throw new Error('секретные детали системы');
    });

    const response = await failing.request('/boom', {}, env);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('секретные детали');
    expect(JSON.parse(text)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });
});
