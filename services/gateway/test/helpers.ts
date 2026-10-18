import { env as workerEnv } from 'cloudflare:workers';
import { expect, type Mock } from 'vitest';
import { createGatewayApp } from '../src/app';
import type { Bindings } from '../src/env';

export type PagesResponder = (request: Request) => Response | Promise<Response>;

/**
 * База окружения настоящая: KV и переменные приходят из vitest-конфига,
 * поэтому тесты проверяют реальные лимиты и заголовки, а не заглушки.
 */
const baseEnv: Bindings = workerEnv;

/**
 * Заглушка Service Binding: тест сам решает, как отвечает pages-service.
 * Приведение типа нужно только потому, что у настоящего биндинга есть ещё
 * методы RPC, которые тестам не нужны.
 */
export function createPagesServiceStub(responder: PagesResponder): Bindings['PAGES_SERVICE'] {
  const binding = Object.assign(async (incoming: Request) => responder(incoming), {
    fetch: async (input: RequestInfo | URL) => responder(new Request(input)),
  });

  return binding as unknown as Bindings['PAGES_SERVICE'];
}

export function createEnv(responder: PagesResponder, overrides: Partial<Bindings> = {}): Bindings {
  return { ...baseEnv, PAGES_SERVICE: createPagesServiceStub(responder), ...overrides };
}

export const app = createGatewayApp();

export function request(
  path: string,
  init?: RequestInit,
  env: Bindings = baseEnv,
): Promise<Response> {
  // Hono отдаёт union «Response | Promise<Response>» — тестам нужен Promise.
  return Promise.resolve(app.request(path, init, env));
}

/** Первый запрос, дошедший до сервиса: падение теста, если сервис не вызвали. */
export function firstRequest(responder: Mock<PagesResponder>): Request {
  const call = responder.mock.calls[0];

  if (!call) {
    throw new Error('Ожидался вызов pages-service, но его не было');
  }

  return call[0];
}

export function healthyPagesServiceResponse(): Response {
  return Response.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: [{ service: 'pages-service', status: 'ok', version: '0.1.0', latencyMs: 1 }],
  });
}

export function pagesOk(): Response {
  return Response.json({ id: '11111111-1111-4111-8111-111111111111', title: 'Страница' });
}

export async function problemOf(response: Response): Promise<Record<string, unknown>> {
  expect(response.headers.get('content-type')).toBe('application/problem+json');
  return (await response.json()) as Record<string, unknown>;
}

export function jsonRequest(body: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}

let ipCounter = 0;

/**
 * Новый IP на вызов: счётчики rate limit живут в KV и переживают границы
 * отдельных тестов, поэтому каждый вызов должен выглядеть как новый клиент.
 */
export function clientHeaders(): Record<string, string> {
  ipCounter += 1;

  return { 'cf-connecting-ip': `198.51.100.${(ipCounter % 200) + 1}` };
}
