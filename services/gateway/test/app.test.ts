import { INTERNAL_HEADERS } from '@notio/contracts';
import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from '../src/app';
import {
  createEnv,
  firstRequest,
  healthyPagesServiceResponse,
  pagesOk,
  problemOf,
  request,
  type PagesResponder,
} from './helpers';

describe('gateway index', () => {
  it('отдаёт индекс публичного API по /', async () => {
    const response = await request('/');
    const body = (await response.json()) as { name: string; endpoints: { path: string }[] };

    expect(response.status).toBe(200);
    expect(body.name).toBe('notio');
    expect(body.endpoints.map((endpoint) => endpoint.path)).toContain('/api/health');
  });

  it('не вызывает внутренние сервисы для индекса и liveness', async () => {
    const responder = vi.fn<PagesResponder>(healthyPagesServiceResponse);

    await request('/health', undefined, createEnv(responder));
    await request('/', undefined, createEnv(responder));

    expect(responder).not.toHaveBeenCalled();
  });
});

describe('gateway /api/health', () => {
  it('агрегирует состояние gateway и pages-service через Service Binding', async () => {
    const responder = vi.fn<PagesResponder>(healthyPagesServiceResponse);

    const response = await request('/api/health', undefined, createEnv(responder));
    const body = (await response.json()) as { status: string; services: { service: string }[] };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.services.map((service) => service.service)).toEqual(['gateway', 'pages-service']);
    expect(new URL(firstRequest(responder).url).pathname).toBe('/health');
  });

  it('отдаёт 503 и degraded, если сервис ответил ошибкой', async () => {
    const response = await request(
      '/api/health',
      undefined,
      createEnv(() => new Response('boom', { status: 500 })),
    );
    const body = (await response.json()) as { services: { error?: string }[] };

    expect(response.status).toBe(503);
    expect(body.services[1]?.error).toContain('HTTP 500');
  });

  it('не падает, если Service Binding недоступен', async () => {
    const response = await request(
      '/api/health',
      undefined,
      createEnv(() => {
        throw new Error('binding недоступен');
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
    const app = createGatewayApp();
    app.get('/boom', () => {
      throw new Error('секретные детали системы');
    });

    const response = await app.request('/boom', {}, createEnv(pagesOk));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('секретные детали');
    expect(JSON.parse(text)).toMatchObject({ code: 'INTERNAL_ERROR' });
  });
});
