import { env as workerEnv } from 'cloudflare:workers';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { expect, vi, type Mock } from 'vitest';
import { createGatewayApp } from '../src/app';
import { getSharedJwksCache } from '../src/middleware/jwt';
import type { Bindings } from '../src/env';

export type PagesResponder = (request: Request) => Response | Promise<Response>;
export type AuthResponder = (request: Request) => Response | Promise<Response>;

/** Тип мока-ответчика Service Binding: тесты проверяют, как сервис вызван. */
export type ResponderMock = Mock<PagesResponder>;

/** Создаёт типизированный мок ответчика: без него тест не видит вызовы сервиса. */
export function responderMock(responder: PagesResponder): ResponderMock {
  return vi.fn<PagesResponder>(responder);
}

/**
 * Первый запрос, дошедший до сервиса.
 * Падает, если сервис не вызывали: иначе тест молча проверял бы пустоту.
 */
export function firstRequest(mock: ResponderMock): Request {
  const incoming = mock.mock.calls[0]?.[0];

  if (!incoming) {
    throw new Error('Сервис не был вызван');
  }

  return incoming;
}

/** Все запросы к сервису — удобно, когда тест проверяет число вызовов. */
export function callsOf(mock: ResponderMock): Request[] {
  return mock.mock.calls.map(([incoming]) => incoming);
}

/**
 * Тесты подписывают токены настоящей парой RSA-ключей: проверка подписи в
 * gateway не заменяется заглушкой, поэтому подделать токен нельзя.
 */
const keyPair = await generateKeyPair('RS256', { extractable: true });
const publicJwk = await exportJWK(keyPair.publicKey);

export const JWKS = {
  keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }],
};

export async function issueToken(
  claims: { sub?: string; email?: string; expiresInSeconds?: number } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = claims.expiresInSeconds ?? 3600;

  return new SignJWT({
    email: claims.email ?? 'user@notio.test',
    sessionId: 'session-test',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setSubject(claims.sub ?? crypto.randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(keyPair.privateKey);
}

export const AUTHORIZATION = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
});

/**
 * База окружения настоящая: KV и переменные приходят из vitest-конфига,
 * поэтому тесты проверяют реальные лимиты и заголовки, а не заглушки.
 */
const baseEnv: Bindings = workerEnv;

/**
 * Заглушка Service Binding: тест сам решает, как отвечает сервис.
 * Приведение типа нужно только потому, что у настоящего биндинга есть ещё
 * методы RPC, которые тестам не нужны.
 */
function createStub(responder: PagesResponder) {
  const binding = Object.assign(async (incoming: Request) => responder(incoming), {
    // Тело запроса к этому моменту уже передано прокси: пересоздавать Request
    // нельзя, иначе поток body окажется использованным и вызов упадёт.
    fetch: async (input: RequestInfo | URL) =>
      responder(input instanceof Request ? input : new Request(input)),
  });

  return binding as unknown as Bindings['PAGES_SERVICE'];
}

export function pagesStub(responder: PagesResponder): Bindings['PAGES_SERVICE'] {
  return createStub(responder);
}

export function authStub(
  responder: AuthResponder = defaultAuthResponder,
): Bindings['AUTH_SERVICE'] {
  return createStub(responder);
}

export function healthyPagesServiceResponse(): Response {
  return Response.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: [{ service: 'pages-service', status: 'ok', version: '0.1.0', latencyMs: 1 }],
  });
}

export function healthyAuthServiceResponse(): Response {
  return Response.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: [{ service: 'auth-service', status: 'ok', version: '0.1.0', latencyMs: 1 }],
  });
}

export function healthyWorkspaceServiceResponse(): Response {
  return Response.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
    services: [{ service: 'workspace-service', status: 'ok', version: '0.1.0', latencyMs: 1 }],
  });
}

/** Ответ workspace-service по умолчанию: health для readiness. */
export function defaultWorkspaceResponder(incoming: Request): Response {
  return new URL(incoming.url).pathname === '/health'
    ? healthyWorkspaceServiceResponse()
    : Response.json({ items: [] });
}

/** Ответ pages-service по умолчанию: успешный ответ внутреннего сервиса. */
export const pagesOk: PagesResponder = healthyPagesServiceResponse;

/** Ответ auth-service по умолчанию: JWKS для токенов и health для readiness. */
export function defaultAuthResponder(incoming: Request): Response {
  const { pathname } = new URL(incoming.url);

  if (pathname === '/api/auth/jwks') {
    return Response.json(JWKS);
  }

  if (pathname === '/health') {
    return healthyAuthServiceResponse();
  }

  return Response.json({ ok: true });
}

export interface EnvOverrides {
  pages?: PagesResponder;
  auth?: AuthResponder;
  workspaces?: PagesResponder;
  bindings?: Partial<Bindings>;
}

export function createEnv(overrides: EnvOverrides = {}): Bindings {
  return {
    ...baseEnv,
    PAGES_SERVICE: pagesStub(overrides.pages ?? healthyPagesServiceResponse),
    AUTH_SERVICE: authStub(overrides.auth ?? defaultAuthResponder),
    WORKSPACE_SERVICE: createStub(
      overrides.workspaces ?? (defaultWorkspaceResponder as PagesResponder),
    ) as Bindings['WORKSPACE_SERVICE'],
    ...overrides.bindings,
  };
}

export const app = createGatewayApp();

export function request(
  path: string,
  init?: RequestInit,
  env: Bindings = createEnv(),
): Promise<Response> {
  // Hono отдаёт union «Response | Promise<Response>» — тестам нужен Promise.
  return Promise.resolve(app.request(path, init, env));
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

/** Кеш JWKS общий для изолята: между тестами его нужно сбрасывать. */
export function resetJwksCache(): void {
  getSharedJwksCache().clear();
}
