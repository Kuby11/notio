import { env as workerEnv } from 'cloudflare:workers';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { expect, vi, type Mock } from 'vitest';
import { createGatewayApp } from '../src/app';
import { getSharedJwksCache } from '../src/middleware/jwt';
import type { Bindings } from '../src/env';

export type PagesResponder = (request: Request) => Response | Promise<Response>;
export type AuthResponder = (request: Request) => Response | Promise<Response>;

/** Type of the Service Binding mock responder: tests assert how the service was called. */
export type ResponderMock = Mock<PagesResponder>;

/** Creates a typed mock responder: without it a test cannot see the service's calls. */
export function responderMock(responder: PagesResponder): ResponderMock {
  return vi.fn<PagesResponder>(responder);
}

/**
 * The first request that reached the service.
 * Fails when the service was never called: otherwise the test would silently check nothing.
 */
export function firstRequest(mock: ResponderMock): Request {
  const incoming = mock.mock.calls[0]?.[0];

  if (!incoming) {
    throw new Error('The service was never called');
  }

  return incoming;
}

export function callsOf(mock: ResponderMock): Request[] {
  return mock.mock.calls.map(([incoming]) => incoming);
}

/**
 * Tests sign tokens with a real RSA key pair: signature verification in the
 * gateway is not replaced by a stub, so a forged token is impossible.
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
 * The environment is real: KV and variables come from the vitest config, so
 * tests exercise the real limits and headers instead of stubs.
 */
const baseEnv: Bindings = workerEnv;

/**
 * Service Binding stub: the test decides how the service answers.
 * The type cast exists only because the real binding also has RPC methods
 * the tests do not need.
 */
function createStub(responder: PagesResponder) {
  const binding = Object.assign(async (incoming: Request) => responder(incoming), {
    // The request body has already been passed to the proxy by this point: rebuilding
    // the Request is impossible, otherwise the body stream would be marked used and the call would throw.
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

export function defaultWorkspaceResponder(incoming: Request): Response {
  return new URL(incoming.url).pathname === '/health'
    ? healthyWorkspaceServiceResponse()
    : Response.json({ items: [] });
}

export const pagesOk: PagesResponder = healthyPagesServiceResponse;

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
  media?: PagesResponder;
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
    MEDIA_SERVICE: createStub(
      overrides.media ?? (defaultWorkspaceResponder as PagesResponder),
    ) as Bindings['MEDIA_SERVICE'],
    ...overrides.bindings,
  };
}

export const app = createGatewayApp();

export function request(
  path: string,
  init?: RequestInit,
  env: Bindings = createEnv(),
): Promise<Response> {
  // Hono returns a "Response | Promise<Response>" union — tests need a Promise.
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
 * A new IP per call: rate limit counters live in KV and survive across
 * individual tests, so every call must look like a new client.
 */
export function clientHeaders(): Record<string, string> {
  ipCounter += 1;

  return { 'cf-connecting-ip': `198.51.100.${(ipCounter % 200) + 1}` };
}

/** The JWKS cache is shared per isolate: it must be reset between tests. */
export function resetJwksCache(): void {
  getSharedJwksCache().clear();
}
