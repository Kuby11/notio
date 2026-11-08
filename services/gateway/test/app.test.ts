import { INTERNAL_HEADERS } from '@notio/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTHORIZATION,
  callsOf,
  createEnv,
  defaultAuthResponder,
  healthyPagesServiceResponse,
  issueToken,
  JWKS,
  problemOf,
  request,
  resetJwksCache,
  responderMock,
  type AuthResponder,
} from './helpers';

/** auth-service could not serve JWKS: there is nothing to sign the token with. */
function failingJwksResponder(): Response {
  return new Response('nope', { status: 500 });
}

beforeEach(() => {
  resetJwksCache();
});

describe('gateway index', () => {
  it('serves the public API index on /', async () => {
    const response = await request('/');
    const body = (await response.json()) as { name: string; endpoints: { path: string }[] };

    expect(response.status).toBe(200);
    expect(body.name).toBe('notio');
    expect(body.endpoints.map((endpoint) => endpoint.path)).toContain('/api/health');
  });

  it('does not call internal services for the index and liveness', async () => {
    const pages = responderMock(healthyPagesServiceResponse);
    const auth = responderMock(defaultAuthResponder);
    const env = createEnv({ pages, auth });

    await request('/health', undefined, env);
    await request('/', undefined, env);

    expect(pages).not.toHaveBeenCalled();
    expect(auth).not.toHaveBeenCalled();
  });
});

describe('gateway /api/health', () => {
  it('aggregates the state of the gateway and all internal services', async () => {
    const response = await request('/api/health', undefined, createEnv());
    const body = (await response.json()) as { status: string; services: { service: string }[] };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.services.map((service) => service.service)).toEqual([
      'gateway',
      'pages-service',
      'auth-service',
      'workspace-service',
    ]);
  });

  it('is reachable without a token: monitoring must not depend on authorization', async () => {
    const response = await request('/api/health');

    expect(response.status).toBe(200);
  });

  it('answers 503 and degraded when a service responded with an error', async () => {
    const response = await request(
      '/api/health',
      undefined,
      createEnv({ pages: () => new Response('boom', { status: 500 }) }),
    );
    const body = (await response.json()) as { services: { error?: string }[] };

    expect(response.status).toBe(503);
    expect(body.services[1]?.error).toContain('HTTP 500');
  });

  it('does not crash when a Service Binding is unavailable', async () => {
    const response = await request(
      '/api/health',
      undefined,
      createEnv({
        auth: () => {
          throw new Error('binding unavailable');
        },
      }),
    );
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
  });
});

describe('gateway error handling', () => {
  it('returns problem+json for an unknown route', async () => {
    const response = await request('/nope');

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('puts the requestId into problem details', async () => {
    const response = await request('/nope', {
      headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'req-777' },
    });

    expect(await problemOf(response)).toMatchObject({ requestId: 'req-777' });
  });

  it('does not leak unhandled error details outward', async () => {
    const app = (await import('../src/app')).createGatewayApp();
    app.get('/boom', () => {
      throw new Error('secret system details');
    });

    const response = await app.request('/boom', {}, createEnv());
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('secret system details');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('public authentication routes', () => {
  it('lets /api/auth/* through without a token', async () => {
    const auth = responderMock(defaultAuthResponder);

    const response = await request('/api/auth/get-session', undefined, createEnv({ auth }));

    expect(response.status).toBe(200);
    expect(auth).toHaveBeenCalled();
  });

  it('does not let /api/pages through without a token', async () => {
    const response = await request('/api/pages');

    expect(response.status).toBe(401);
    expect(await problemOf(response)).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

describe('token verification', () => {
  it('lets a request with a valid token through', async () => {
    const token = await issueToken();

    const response = await request('/api/pages', { headers: AUTHORIZATION(token) }, createEnv());

    expect(response.status).toBe(200);
  });

  it('rejects a token signed by someone else', async () => {
    const foreign = responderMock(() => Response.json({ keys: [] }));

    const response = await request(
      '/api/pages',
      { headers: AUTHORIZATION(await issueToken()) },
      createEnv({ auth: foreign }),
    );

    expect(response.status).toBe(401);
    expect(await problemOf(response)).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('rejects an expired token', async () => {
    const expired = await issueToken({ expiresInSeconds: -60 });

    const response = await request('/api/pages', { headers: AUTHORIZATION(expired) }, createEnv());

    expect(response.status).toBe(401);
    expect(await problemOf(response)).toMatchObject({
      detail: expect.stringContaining('invalid'),
    });
  });

  it('rejects garbage in place of a token', async () => {
    const response = await request(
      '/api/pages',
      { headers: { authorization: 'Bearer not-a-jwt' } },
      createEnv(),
    );

    expect(response.status).toBe(401);
  });

  it('rejects a token without the Bearer prefix', async () => {
    const token = await issueToken();

    const response = await request(
      '/api/pages',
      { headers: { authorization: token } },
      createEnv(),
    );

    expect(response.status).toBe(401);
  });

  it('answers 401 when auth-service does not serve JWKS', async () => {
    const auth: AuthResponder = failingJwksResponder;

    const response = await request(
      '/api/pages',
      { headers: AUTHORIZATION(await issueToken()) },
      createEnv({ auth }),
    );

    expect(response.status).toBe(401);
  });

  it('fetches JWKS from auth-service once and caches it', async () => {
    const auth = responderMock(defaultAuthResponder);
    const env = createEnv({ auth });
    const token = await issueToken();

    await request('/api/pages', { headers: AUTHORIZATION(token) }, env);
    await request('/api/pages', { headers: AUTHORIZATION(token) }, env);

    const jwksCalls = callsOf(auth).filter((incoming) =>
      new URL(incoming.url).pathname.includes('jwks'),
    );

    expect(jwksCalls).toHaveLength(1);
    expect(JWKS.keys).toHaveLength(1);
  });
});
