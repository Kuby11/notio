import { PROBLEM_CONTENT_TYPE } from '@notio/contracts';
import { env as workerEnv } from 'cloudflare:workers';
import { describe, expect, it, vi } from 'vitest';
import { createGatewayApp } from './app';
import type { Bindings } from './env';

type PagesResponder = (request: Request) => Response | Promise<Response>;

const BASE_BINDINGS = {
  ENVIRONMENT: workerEnv.ENVIRONMENT,
  SERVICE_VERSION: workerEnv.SERVICE_VERSION,
} satisfies Omit<Bindings, 'PAGES_SERVICE'>;

/**
 * Заглушка Service Binding: тест сам решает, как отвечает pages-service.
 * Приведение типа нужно только потому, что у настоящего биндинга есть ещё
 * методы RPC, которые тестам не нужны.
 */
function createPagesServiceStub(responder: PagesResponder): Bindings['PAGES_SERVICE'] {
  const binding = Object.assign((request: Request) => responder(request), {
    fetch: (input: RequestInfo | URL) => responder(new Request(input)),
  });

  return binding as unknown as Bindings['PAGES_SERVICE'];
}

function createEnv(responder: PagesResponder): Bindings {
  return { ...BASE_BINDINGS, PAGES_SERVICE: createPagesServiceStub(responder) };
}

function healthyPagesServiceResponse(): Response {
  return Response.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: [{ service: 'pages-service', status: 'ok', version: '0.1.0', latencyMs: 0 }],
  });
}

describe('gateway /health', () => {
  it('отвечает ok, не вызывая внутренние сервисы', async () => {
    const responder = vi.fn<PagesResponder>(healthyPagesServiceResponse);
    const app = createGatewayApp();

    const response = await app.request('/health', {}, createEnv(responder));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      services: [{ service: 'gateway', status: 'ok' }],
    });
    expect(responder).not.toHaveBeenCalled();
  });
});

describe('gateway /api/health', () => {
  it('агрегирует состояние gateway и pages-service через Service Binding', async () => {
    const responder = vi.fn<PagesResponder>(healthyPagesServiceResponse);
    const app = createGatewayApp();

    const response = await app.request('/api/health', {}, createEnv(responder));
    const body = (await response.json()) as { status: string; services: { service: string }[] };

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.services.map((service) => service.service)).toEqual(['gateway', 'pages-service']);
    expect(responder).toHaveBeenCalledOnce();
    expect(responder.mock.calls[0]?.[0].url).toContain('/health');
  });

  it('отдаёт 503 и degraded, если сервис ответил ошибкой', async () => {
    const app = createGatewayApp();
    const response = await app.request(
      '/api/health',
      {},
      createEnv(() => new Response('boom', { status: 500 })),
    );
    const body = (await response.json()) as { status: string; services: { error?: string }[] };

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.services[1]?.error).toContain('HTTP 500');
  });

  it('отдаёт degraded, если ответ сервиса не соответствует контракту', async () => {
    const app = createGatewayApp();
    const response = await app.request(
      '/api/health',
      {},
      createEnv(() => Response.json({ status: 'что-то другое' })),
    );
    const body = (await response.json()) as { services: { error?: string }[] };

    expect(response.status).toBe(503);
    expect(body.services[1]?.error).toContain('HealthResponseSchema');
  });

  it('не падает, если Service Binding недоступен', async () => {
    const app = createGatewayApp();
    const response = await app.request(
      '/api/health',
      {},
      createEnv(() => {
        throw new Error('binding недоступен');
      }),
    );
    const body = (await response.json()) as { status: string; services: { error?: string }[] };

    expect(response.status).toBe(503);
    expect(body.status).toBe('degraded');
    expect(body.services[1]?.error).toContain('binding недоступен');
  });
});

describe('gateway обработка ошибок', () => {
  it('возвращает problem+json для неизвестного маршрута', async () => {
    const app = createGatewayApp();
    const response = await app.request('/nope', {}, createEnv(healthyPagesServiceResponse));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
    expect(body).toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('не выдаёт детали необработанной ошибки наружу', async () => {
    const app = createGatewayApp();
    app.get('/boom', () => {
      throw new Error('секретные детали системы');
    });

    const response = await app.request('/boom', {}, createEnv(healthyPagesServiceResponse));
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(text).not.toContain('секретные детали');
    expect(JSON.parse(text)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
  });
});
