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
  it('отдаёт индекс публичного API по /', async () => {
    const response = await request('/');
    const body = (await response.json()) as { name: string; endpoints: { path: string }[] };

    expect(response.status).toBe(200);
    expect(body.name).toBe('notio');
    expect(body.endpoints.map((endpoint) => endpoint.path)).toContain('/api/health');
  });

  it('не вызывает внутренние сервисы для индекса и liveness', async () => {
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
  it('агрегирует состояние gateway и всех внутренних сервисов', async () => {
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

  it('доступен без токена: мониторинг не должен зависеть от авторизации', async () => {
    const response = await request('/api/health');

    expect(response.status).toBe(200);
  });

  it('отдаёт 503 и degraded, если сервис ответил ошибкой', async () => {
    const response = await request(
      '/api/health',
      undefined,
      createEnv({ pages: () => new Response('boom', { status: 500 }) }),
    );
    const body = (await response.json()) as { services: { error?: string }[] };

    expect(response.status).toBe(503);
    expect(body.services[1]?.error).toContain('HTTP 500');
  });

  it('не падает, если Service Binding недоступен', async () => {
    const response = await request(
      '/api/health',
      undefined,
      createEnv({
        auth: () => {
          throw new Error('binding недоступен');
        },
      }),
    );
    const body = (await response.json()) as { status: string };

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
  });
});

describe('gateway обработка ошибок', () => {
  it('возвращает problem+json для неизвестного маршрута', async () => {
    const response = await request('/nope');

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('проставляет requestId в problem details', async () => {
    const response = await request('/nope', {
      headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'req-777' },
    });

    expect(await problemOf(response)).toMatchObject({ requestId: 'req-777' });
  });

  it('не выдаёт детали необработанной ошибки наружу', async () => {
    const app = (await import('../src/app')).createGatewayApp();
    app.get('/boom', () => {
      throw new Error('секретные детали системы');
    });

    const response = await app.request('/boom', {}, createEnv());
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('секретные детали');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});

describe('публичные маршруты аутентификации', () => {
  it('пропускает /api/auth/* без токена', async () => {
    const auth = responderMock(defaultAuthResponder);

    const response = await request('/api/auth/get-session', undefined, createEnv({ auth }));

    expect(response.status).toBe(200);
    expect(auth).toHaveBeenCalled();
  });

  it('не пропускает /api/pages без токена', async () => {
    const response = await request('/api/pages');

    expect(response.status).toBe(401);
    expect(await problemOf(response)).toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});

describe('проверка токена', () => {
  it('пропускает запрос с валидным токеном', async () => {
    const token = await issueToken();

    const response = await request('/api/pages', { headers: AUTHORIZATION(token) }, createEnv());

    expect(response.status).toBe(200);
  });

  it('отклоняет токен с чужой подписью', async () => {
    const foreign = responderMock(() => Response.json({ keys: [] }));

    const response = await request(
      '/api/pages',
      { headers: AUTHORIZATION(await issueToken()) },
      createEnv({ auth: foreign }),
    );

    expect(response.status).toBe(401);
    expect(await problemOf(response)).toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('отклоняет истёкший токен', async () => {
    const expired = await issueToken({ expiresInSeconds: -60 });

    const response = await request('/api/pages', { headers: AUTHORIZATION(expired) }, createEnv());

    expect(response.status).toBe(401);
    expect(await problemOf(response)).toMatchObject({
      detail: expect.stringContaining('недействителен'),
    });
  });

  it('отклоняет мусор вместо токена', async () => {
    const response = await request(
      '/api/pages',
      { headers: { authorization: 'Bearer not-a-jwt' } },
      createEnv(),
    );

    expect(response.status).toBe(401);
  });

  it('отклоняет токен без префикса Bearer', async () => {
    const token = await issueToken();

    const response = await request(
      '/api/pages',
      { headers: { authorization: token } },
      createEnv(),
    );

    expect(response.status).toBe(401);
  });

  it('отвечает 401, если auth-service не отдал JWKS', async () => {
    const auth: AuthResponder = failingJwksResponder;

    const response = await request(
      '/api/pages',
      { headers: AUTHORIZATION(await issueToken()) },
      createEnv({ auth }),
    );

    expect(response.status).toBe(401);
  });

  it('берёт JWKS у auth-service один раз и кеширует', async () => {
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
