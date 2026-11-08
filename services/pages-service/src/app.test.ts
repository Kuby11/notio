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
  it('responds ok and describes the service itself', async () => {
    const response = await app.request('/health', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      services: [{ service: 'pages-service', status: 'ok' }],
    });
  });

  it('takes the version from environment variables', async () => {
    const response = await app.request('/health', {}, { ...env, SERVICE_VERSION: '9.9.9' });
    const body = (await response.json()) as { version: string };

    expect(body.version).toBe('9.9.9');
  });

  it('has its own D1 database (database-per-service)', () => {
    expect(env.DB).toBeDefined();
  });
});

describe('pages-service error handling', () => {
  it('returns problem+json for an unknown route', async () => {
    const response = await app.request('/nope', {}, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
    expect(body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('does not leak unhandled error details', async () => {
    const failing = createPagesServiceApp();
    failing.get('/boom', () => {
      throw new Error('secret internal details');
    });

    const response = await failing.request('/boom', {}, env);
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('secret internal details');
    expect(JSON.parse(text)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });
});
