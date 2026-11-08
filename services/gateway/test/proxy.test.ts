import { GATEWAY_SOURCE, INTERNAL_HEADERS, SERVICE_RESPONSE_HEADER } from '@notio/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { userIdFromRequest } from '../src/routes/proxy';
import {
  AUTHORIZATION,
  clientHeaders,
  createEnv,
  firstRequest,
  healthyAuthServiceResponse,
  JWKS,
  issueToken,
  jsonRequest,
  pagesOk,
  problemOf,
  request,
  resetJwksCache,
  responderMock,
} from './helpers';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const BLOCK_ID = '00000000-0000-4000-8000-000000000002';
const USER_ID = '00000000-0000-4000-8000-00000000000a';

/** Service response with an internal header: the client must not see it. */
function upstreamResponseWithInternalHeaders(): Response {
  return new Response('{"ok":true}', {
    status: 201,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'x-internal-secret': 'hidden',
    },
  });
}

beforeEach(() => {
  resetJwksCache();
});

/** Request to a protected route from an authenticated user. */
async function authedInit(extra: RequestInit = {}): Promise<RequestInit> {
  const token = await issueToken({ sub: USER_ID });

  return {
    ...extra,
    headers: { ...clientHeaders(), ...AUTHORIZATION(token), ...extra.headers },
  };
}

describe('proxying to pages-service', () => {
  it('rewrites the path /api/pages → /pages and keeps the query', async () => {
    const pages = responderMock(pagesOk);

    await request(
      `/api/pages?workspaceId=${WORKSPACE_ID}`,
      await authedInit(),
      createEnv({ pages }),
    );

    const forwardedUrl = new URL(firstRequest(pages).url);

    expect(forwardedUrl.pathname).toBe('/pages');
    expect(forwardedUrl.searchParams.get('workspaceId')).toBe(WORKSPACE_ID);
  });

  it('rewrites a nested resource path', async () => {
    const pages = responderMock(pagesOk);

    await request(`/api/pages/${WORKSPACE_ID}`, await authedInit(), createEnv({ pages }));

    expect(new URL(firstRequest(pages).url).pathname).toBe(`/pages/${WORKSPACE_ID}`);
  });

  it('passes the body and method through unchanged', async () => {
    const pages = responderMock(pagesOk);

    const response = await request(
      '/api/pages',
      await authedInit(jsonRequest({ workspaceId: WORKSPACE_ID, title: 'From gateway' })),
      createEnv({ pages }),
    );

    expect(response.status).toBe(200);
    expect(firstRequest(pages).method).toBe('POST');
    expect(await firstRequest(pages).clone().json()).toEqual({
      workspaceId: WORKSPACE_ID,
      title: 'From gateway',
    });
  });

  it('serves a media file without a token: capability URL for <img>/<video>', async () => {
    const media = responderMock(pagesOk);

    const response = await request(
      '/api/media/files/00000000-0000-4000-8000-0000000000aa',
      { headers: clientHeaders() },
      createEnv({ media }),
    );

    expect(response.status).toBe(200);
    expect(new URL(firstRequest(media).url).pathname).toBe(
      '/media/files/00000000-0000-4000-8000-0000000000aa',
    );
  });

  it('requires a token for media uploads even when reads are public', async () => {
    const media = responderMock(pagesOk);

    const response = await request(
      '/api/media/files',
      { method: 'POST', headers: clientHeaders() },
      createEnv({ media }),
    );

    expect(response.status).toBe(401);
    expect(media).not.toHaveBeenCalled();
  });

  it('routes media /api/media to media-service', async () => {
    const media = responderMock(pagesOk);

    const response = await request(
      '/api/media/files',
      await authedInit(jsonRequest({ workspaceId: WORKSPACE_ID })),
      createEnv({ media }),
    );

    expect(response.status).toBe(200);
    expect(new URL(firstRequest(media).url).pathname).toBe('/media/files');
    expect(firstRequest(media).method).toBe('POST');
    expect(response.headers.get(SERVICE_RESPONSE_HEADER)).toBe('media-service');
  });

  it('routes blocks /api/blocks to pages-service', async () => {
    const pages = responderMock(pagesOk);

    const response = await request(
      '/api/blocks',
      await authedInit(jsonRequest({ pageId: WORKSPACE_ID, content: { type: 'divider' } })),
      createEnv({ pages }),
    );

    expect(response.status).toBe(200);
    expect(new URL(firstRequest(pages).url).pathname).toBe('/blocks');
    expect(firstRequest(pages).method).toBe('POST');
    expect(response.headers.get(SERVICE_RESPONSE_HEADER)).toBe('pages-service');
  });

  it('rewrites nested block routes', async () => {
    const pages = responderMock(pagesOk);

    await request(
      `/api/blocks/${BLOCK_ID}/move`,
      await authedInit(jsonRequest({})),
      createEnv({ pages }),
    );

    expect(new URL(firstRequest(pages).url).pathname).toBe(`/blocks/${BLOCK_ID}/move`);
  });

  it('marks the call with its source and reports the routing back', async () => {
    const pages = responderMock(pagesOk);

    const response = await request('/api/pages', await authedInit(), createEnv({ pages }));

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.SOURCE_SERVICE)).toBe(GATEWAY_SOURCE);
    expect(response.headers.get(SERVICE_RESPONSE_HEADER)).toBe('pages-service');
  });

  it('passes the user from the signed token to the service', async () => {
    const pages = responderMock(pagesOk);

    await request('/api/pages', await authedInit(), createEnv({ pages }));

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.ACTOR_ID)).toBe(USER_ID);
  });

  it('does not pass a forged user header to the service', async () => {
    const pages = responderMock(pagesOk);
    const init = await authedInit({
      headers: { 'x-user-id': '11111111-1111-4111-8111-111111111111' },
    });

    await request('/api/pages', init, createEnv({ pages }));

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.ACTOR_ID)).toBe(USER_ID);
  });

  it('does not pass an identifier when no token is presented', async () => {
    const pages = responderMock(pagesOk);

    // A request without a token never reaches the service: 401 on the closed route.
    const response = await request(
      '/api/pages',
      { headers: clientHeaders() },
      createEnv({ pages }),
    );

    expect(response.status).toBe(401);
    expect(pages).not.toHaveBeenCalled();
  });

  it('forwards a valid client request-id: end-to-end tracing', async () => {
    const pages = responderMock(pagesOk);

    const response = await request(
      '/api/pages',
      await authedInit({ headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'trace-from-client' } }),
      createEnv({ pages }),
    );

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe('trace-from-client');
    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe('trace-from-client');
  });

  it('replaces an identifier that fails the policy', async () => {
    const pages = responderMock(pagesOk);

    const response = await request(
      '/api/pages',
      await authedInit({ headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'bad id with spaces' } }),
      createEnv({ pages }),
    );

    const forwarded = firstRequest(pages).headers.get(INTERNAL_HEADERS.REQUEST_ID);

    expect(forwarded).not.toContain('bad id');
    expect(forwarded).toBe(response.headers.get(INTERNAL_HEADERS.REQUEST_ID));
  });

  it('does not forward hop-by-hop headers and host', async () => {
    const pages = responderMock(pagesOk);

    await request(
      '/api/pages',
      await authedInit({
        headers: {
          connection: 'keep-alive',
          'transfer-encoding': 'chunked',
          host: 'spoofed.example',
          'x-custom': 'custom-value',
        },
      }),
      createEnv({ pages }),
    );

    const headers = firstRequest(pages).headers;

    expect(headers.get('connection')).toBeNull();
    expect(headers.get('transfer-encoding')).toBeNull();
    expect(headers.get('host')).toBeNull();
    expect(headers.get('x-custom')).toBe('custom-value');
  });

  it('serves only safe response headers to the client', async () => {
    const response = await request(
      '/api/pages',
      await authedInit(),
      createEnv({ pages: upstreamResponseWithInternalHeaders }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-internal-secret')).toBeNull();
  });

  it('returns 503 problem+json when the service is unavailable', async () => {
    const response = await request(
      '/api/pages',
      await authedInit(),
      createEnv({
        pages: () => {
          throw new Error('service crashed');
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(await problemOf(response)).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('leaves routes outside proxied prefixes untouched', async () => {
    const pages = responderMock(pagesOk);

    const response = await request('/other', await authedInit(), createEnv({ pages }));

    expect(response.status).toBe(404);
    expect(pages).not.toHaveBeenCalled();
  });
});

describe('proxying to auth-service', () => {
  it('routes /api/auth/* to auth-service without the gateway prefix', async () => {
    const auth = responderMock(() => Response.json({ ok: true }));

    const response = await request(
      '/api/auth/get-session',
      { headers: clientHeaders() },
      createEnv({ auth }),
    );

    expect(response.status).toBe(200);
    expect(new URL(firstRequest(auth).url).pathname).toBe('/api/auth/get-session');
    expect(response.headers.get(SERVICE_RESPONSE_HEADER)).toBe('auth-service');
  });

  it('passes the session cookie, otherwise browser sign-in breaks', async () => {
    const auth = responderMock(() => Response.json({ user: null }));

    await request(
      '/api/auth/get-session',
      { headers: { ...clientHeaders(), cookie: 'notio.session_token=abc' } },
      createEnv({ auth }),
    );

    expect(firstRequest(auth).headers.get('cookie')).toBe('notio.session_token=abc');
  });

  it('serves Set-Cookie to the client: without it the session would not stick', async () => {
    const auth = responderMock(
      () =>
        new Response('{}', {
          headers: [
            ['content-type', 'application/json'],
            ['set-cookie', 'notio.session_token=abc; Path=/; HttpOnly'],
          ],
        }),
    );

    const response = await request(
      '/api/auth/get-session',
      { headers: clientHeaders() },
      createEnv({ auth }),
    );

    expect(response.headers.getSetCookie().join(';')).toContain('notio.session_token=abc');
  });

  it('proxies the auth-service decision unchanged', async () => {
    const auth = responderMock(() => Response.json({ success: false }, { status: 403 }));

    const response = await request(
      '/api/auth/sign-out',
      jsonRequest({}, { 'cf-connecting-ip': '203.0.113.77' }),
      createEnv({ auth }),
    );

    // Origin checking is auth-service's job; the gateway does not duplicate the service's rules.
    expect(auth).toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(response.headers.get(SERVICE_RESPONSE_HEADER)).toBe('auth-service');
  });

  it('fetches JWKS from auth-service for token verification', async () => {
    const auth = responderMock((incoming: Request) => {
      const path = new URL(incoming.url).pathname;

      return path === '/api/auth/jwks' ? Response.json(JWKS) : healthyAuthServiceResponse();
    });

    await request('/api/pages', await authedInit(), createEnv({ auth }));

    expect(auth).toHaveBeenCalled();
  });
});

describe('identity for services', () => {
  it('returns undefined when the user is not identified', () => {
    const context = { get: () => null };

    expect(userIdFromRequest(context)).toBeUndefined();
  });

  it('returns the user id from the context', () => {
    const context = { get: () => ({ id: 'user-1', claims: { sub: 'user-1', exp: 0 } }) };

    expect(userIdFromRequest(context)).toBe('user-1');
  });
});
