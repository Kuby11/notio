import { GATEWAY_SOURCE, INTERNAL_HEADERS, SERVICE_RESPONSE_HEADER } from '@notio/contracts';
import { describe, expect, it, vi } from 'vitest';
import { actorIdFromRequest } from '../src/routes/proxy';
import {
  clientHeaders,
  createEnv,
  firstRequest,
  jsonRequest,
  pagesOk,
  problemOf,
  request,
  type PagesResponder,
} from './helpers';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const ACTOR = '00000000-0000-4000-8000-00000000000a';

describe('проксирование в pages-service', () => {
  it('переписывает путь /api/pages → /pages и сохраняет query', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    await request(
      `/api/pages?workspaceId=${WORKSPACE_ID}`,
      { headers: clientHeaders() },
      createEnv(responder),
    );

    const forwardedUrl = new URL(firstRequest(responder).url);
    expect(forwardedUrl.pathname).toBe('/pages');
    expect(forwardedUrl.searchParams.get('workspaceId')).toBe(WORKSPACE_ID);
  });

  it('переписывает путь вложенного ресурса', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    await request(`/api/pages/${WORKSPACE_ID}`, { headers: clientHeaders() }, createEnv(responder));

    expect(new URL(firstRequest(responder).url).pathname).toBe(`/pages/${WORKSPACE_ID}`);
  });

  it('передаёт тело и метод без изменений', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    const response = await request(
      '/api/pages',
      jsonRequest({ workspaceId: WORKSPACE_ID, title: 'Из gateway' }, clientHeaders()),
      createEnv(responder),
    );

    expect(response.status).toBe(200);
    expect(firstRequest(responder).method).toBe('POST');
    expect(await firstRequest(responder).clone().json()).toEqual({
      workspaceId: WORKSPACE_ID,
      title: 'Из gateway',
    });
  });

  it('помечает вызов источником и возвращает маршрутизацию', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    const response = await request(
      '/api/pages',
      { headers: clientHeaders() },
      createEnv(responder),
    );

    expect(firstRequest(responder).headers.get(INTERNAL_HEADERS.SOURCE_SERVICE)).toBe(
      GATEWAY_SOURCE,
    );
    expect(response.headers.get(SERVICE_RESPONSE_HEADER)).toBe('pages-service');
  });

  it('пробрасывает валидный клиентский request-id: сквозная трассировка', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    const response = await request(
      '/api/pages',
      { headers: { ...clientHeaders(), [INTERNAL_HEADERS.REQUEST_ID]: 'trace-from-client' } },
      createEnv(responder),
    );

    expect(firstRequest(responder).headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe(
      'trace-from-client',
    );
    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe('trace-from-client');
  });

  it('подменяет идентификатор, не проходящий политику', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    const response = await request(
      '/api/pages',
      { headers: { ...clientHeaders(), [INTERNAL_HEADERS.REQUEST_ID]: 'bad id with spaces' } },
      createEnv(responder),
    );

    const forwarded = firstRequest(responder).headers.get(INTERNAL_HEADERS.REQUEST_ID);
    expect(forwarded).not.toContain('bad id');
    expect(forwarded).toBe(response.headers.get(INTERNAL_HEADERS.REQUEST_ID));
  });

  it('не пересылает hop-by-hop заголовки и host', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    await request(
      '/api/pages',
      {
        headers: {
          ...clientHeaders(),
          connection: 'keep-alive',
          'transfer-encoding': 'chunked',
          host: 'spoofed.example',
          'x-custom': 'custom-value',
        },
      },
      createEnv(responder),
    );

    const headers = firstRequest(responder).headers;
    expect(headers.get('connection')).toBeNull();
    expect(headers.get('transfer-encoding')).toBeNull();
    expect(headers.get('host')).toBeNull();
    expect(headers.get('x-custom')).toBe('custom-value');
  });

  it('отдаёт клиенту только безопасные заголовки ответа', async () => {
    const upstream = new Response('{"ok":true}', {
      status: 201,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'set-cookie': 'secret=value',
        'x-internal-secret': 'hidden',
      },
    });

    const response = await request(
      '/api/pages',
      { headers: clientHeaders() },
      createEnv(() => upstream),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-internal-secret')).toBeNull();
  });

  it('возвращает 503 problem+json, если сервис недоступен', async () => {
    const response = await request(
      '/api/pages',
      { headers: clientHeaders() },
      createEnv(() => {
        throw new Error('сервис упал');
      }),
    );

    expect(response.status).toBe(503);
    expect(await problemOf(response)).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('не трогает маршруты вне /api/pages', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    const response = await request('/other', { headers: clientHeaders() }, createEnv(responder));

    expect(response.status).toBe(404);
    expect(responder).not.toHaveBeenCalled();
  });
});

describe('идентичность пользователя', () => {
  it('в разработке принимает x-actor-id и передаёт сервису', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);
    const env = createEnv(responder, { ENVIRONMENT: 'development' });

    await request('/api/pages', { headers: { ...clientHeaders(), 'x-actor-id': ACTOR } }, env);

    expect(firstRequest(responder).headers.get(INTERNAL_HEADERS.ACTOR_ID)).toBe(ACTOR);
  });

  it('в production игнорирует заголовок клиента (fail closed до Этапа 2)', () => {
    const clientRequest = new Request('https://gateway.notio.dev/api/pages', {
      headers: { 'x-actor-id': ACTOR },
    });
    const env = createEnv(pagesOk, { ENVIRONMENT: 'production' });

    expect(actorIdFromRequest(env, clientRequest)).toBeUndefined();
  });

  it('в production не передаёт сервису подделанный идентификатор', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);
    const env = createEnv(responder, { ENVIRONMENT: 'production' });

    await request('/api/pages', { headers: { ...clientHeaders(), 'x-actor-id': ACTOR } }, env);

    expect(firstRequest(responder).headers.get(INTERNAL_HEADERS.ACTOR_ID)).toBeNull();
  });

  it('игнорирует клиентскую попытку выдать себя за gateway', async () => {
    const responder = vi.fn<PagesResponder>(pagesOk);

    await request(
      '/api/pages',
      { headers: { ...clientHeaders(), [INTERNAL_HEADERS.SOURCE_SERVICE]: 'unknown-service' } },
      createEnv(responder),
    );

    expect(firstRequest(responder).headers.get(INTERNAL_HEADERS.SOURCE_SERVICE)).toBe(
      GATEWAY_SOURCE,
    );
  });
});
