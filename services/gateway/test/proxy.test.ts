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

describe('проксирование в pages-service', () => {
  it('переписывает путь /api/pages → /pages и сохраняет query', async () => {
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

  it('переписывает путь вложенного ресурса', async () => {
    const pages = responderMock(pagesOk);

    await request(`/api/pages/${WORKSPACE_ID}`, await authedInit(), createEnv({ pages }));

    expect(new URL(firstRequest(pages).url).pathname).toBe(`/pages/${WORKSPACE_ID}`);
  });

  it('передаёт тело и метод без изменений', async () => {
    const pages = responderMock(pagesOk);

    const response = await request(
      '/api/pages',
      await authedInit(jsonRequest({ workspaceId: WORKSPACE_ID, title: 'Из gateway' })),
      createEnv({ pages }),
    );

    expect(response.status).toBe(200);
    expect(firstRequest(pages).method).toBe('POST');
    expect(await firstRequest(pages).clone().json()).toEqual({
      workspaceId: WORKSPACE_ID,
      title: 'Из gateway',
    });
  });

  it('отдаёт файл медиа без токена: capability URL для <img>/<video>', async () => {
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

  it('требует токен для загрузки медиа даже при публичном чтении', async () => {
    const media = responderMock(pagesOk);

    const response = await request(
      '/api/media/files',
      { method: 'POST', headers: clientHeaders() },
      createEnv({ media }),
    );

    expect(response.status).toBe(401);
    expect(media).not.toHaveBeenCalled();
  });

  it('маршрутизирует медиа /api/media в media-service', async () => {
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

  it('маршрутизирует блоки /api/blocks в pages-service', async () => {
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

  it('переписывает вложенные маршруты блоков', async () => {
    const pages = responderMock(pagesOk);

    await request(
      `/api/blocks/${BLOCK_ID}/move`,
      await authedInit(jsonRequest({})),
      createEnv({ pages }),
    );

    expect(new URL(firstRequest(pages).url).pathname).toBe(`/blocks/${BLOCK_ID}/move`);
  });

  it('помечает вызов источником и возвращает маршрутизацию', async () => {
    const pages = responderMock(pagesOk);

    const response = await request('/api/pages', await authedInit(), createEnv({ pages }));

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.SOURCE_SERVICE)).toBe(GATEWAY_SOURCE);
    expect(response.headers.get(SERVICE_RESPONSE_HEADER)).toBe('pages-service');
  });

  it('передаёт сервису пользователя из подписанного токена', async () => {
    const pages = responderMock(pagesOk);

    await request('/api/pages', await authedInit(), createEnv({ pages }));

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.ACTOR_ID)).toBe(USER_ID);
  });

  it('не передаёт сервису подделанный заголовок пользователя', async () => {
    const pages = responderMock(pagesOk);
    const init = await authedInit({
      headers: { 'x-user-id': '11111111-1111-4111-8111-111111111111' },
    });

    await request('/api/pages', init, createEnv({ pages }));

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.ACTOR_ID)).toBe(USER_ID);
  });

  it('не передаёт идентификатор, если токен не предъявлен', async () => {
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

  it('пробрасывает валидный клиентский request-id: сквозная трассировка', async () => {
    const pages = responderMock(pagesOk);

    const response = await request(
      '/api/pages',
      await authedInit({ headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'trace-from-client' } }),
      createEnv({ pages }),
    );

    expect(firstRequest(pages).headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe('trace-from-client');
    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe('trace-from-client');
  });

  it('подменяет идентификатор, не проходящий политику', async () => {
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

  it('не пересылает hop-by-hop заголовки и host', async () => {
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

  it('отдаёт клиенту только безопасные заголовки ответа', async () => {
    const response = await request(
      '/api/pages',
      await authedInit(),
      createEnv({ pages: upstreamResponseWithInternalHeaders }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-internal-secret')).toBeNull();
  });

  it('возвращает 503 problem+json, если сервис недоступен', async () => {
    const response = await request(
      '/api/pages',
      await authedInit(),
      createEnv({
        pages: () => {
          throw new Error('сервис упал');
        },
      }),
    );

    expect(response.status).toBe(503);
    expect(await problemOf(response)).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('не трогает маршруты вне проксируемых префиксов', async () => {
    const pages = responderMock(pagesOk);

    const response = await request('/other', await authedInit(), createEnv({ pages }));

    expect(response.status).toBe(404);
    expect(pages).not.toHaveBeenCalled();
  });
});

describe('проксирование в auth-service', () => {
  it('маршрутизирует /api/auth/* в auth-service без префикса gateway', async () => {
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

  it('передаёт cookie сессии, иначе вход через браузер не работает', async () => {
    const auth = responderMock(() => Response.json({ user: null }));

    await request(
      '/api/auth/get-session',
      { headers: { ...clientHeaders(), cookie: 'notio.session_token=abc' } },
      createEnv({ auth }),
    );

    expect(firstRequest(auth).headers.get('cookie')).toBe('notio.session_token=abc');
  });

  it('отдаёт Set-Cookie клиенту: без него сессия не сохранится', async () => {
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

  it('проксирует решение auth-service без изменений', async () => {
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

  it('достаёт JWKS у auth-service для проверки токена', async () => {
    const auth = responderMock((incoming: Request) => {
      const path = new URL(incoming.url).pathname;

      return path === '/api/auth/jwks' ? Response.json(JWKS) : healthyAuthServiceResponse();
    });

    await request('/api/pages', await authedInit(), createEnv({ auth }));

    expect(auth).toHaveBeenCalled();
  });
});

describe('identity для сервисов', () => {
  it('возвращает undefined, когда пользователь не определён', () => {
    const context = { get: () => null };

    expect(userIdFromRequest(context)).toBeUndefined();
  });

  it('возвращает id пользователя из контекста', () => {
    const context = { get: () => ({ id: 'user-1', claims: { sub: 'user-1', exp: 0 } }) };

    expect(userIdFromRequest(context)).toBe('user-1');
  });
});
