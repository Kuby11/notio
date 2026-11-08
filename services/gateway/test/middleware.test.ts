import { INTERNAL_HEADERS } from '@notio/contracts';
import { beforeEach, describe, expect, it } from 'vitest';
import { clientIdentifier, currentWindow, rateLimitKey } from '../src/middleware/rate-limit';
import { isValidRequestId } from '../src/middleware/request-id';
import {
  AUTHORIZATION,
  clientHeaders,
  createEnv,
  issueToken,
  problemOf,
  request,
  resetJwksCache,
} from './helpers';

/** A unique IP per test: KV state survives across individual tests. */
let ipCounter = 0;
function uniqueIp(): string {
  ipCounter += 1;

  return `203.0.113.${ipCounter}`;
}

beforeEach(() => {
  resetJwksCache();
});

/** Authorization headers of a request to a protected route. */
async function authHeaders(): Promise<Record<string, string>> {
  return { ...AUTHORIZATION(await issueToken()), ...clientHeaders() };
}

describe('request-id', () => {
  it('generates an identifier when the client sends none', async () => {
    const response = await request('/');

    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('accepts a valid client identifier', async () => {
    const response = await request('/', {
      headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'req_from_client' },
    });

    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).toBe('req_from_client');
  });

  it('discards an identifier that fails the policy', async () => {
    const response = await request('/', {
      headers: { [INTERNAL_HEADERS.REQUEST_ID]: 'req from client!' },
    });

    expect(response.headers.get(INTERNAL_HEADERS.REQUEST_ID)).not.toBe('req from client!');
    expect(isValidRequestId('req\ninjected: header')).toBe(false);
  });

  it('allows only short safe values', () => {
    expect(isValidRequestId('a-b_C9')).toBe(true);
    expect(isValidRequestId('a'.repeat(65))).toBe(false);
    expect(isValidRequestId('')).toBe(false);
    expect(isValidRequestId(undefined)).toBe(false);
  });
});

describe('security headers', () => {
  it('sets protective headers on every response', async () => {
    const response = await request('/');

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'");
  });

  it('sets protective headers on proxied responses too', async () => {
    const response = await request('/api/pages', { headers: await authHeaders() }, createEnv());

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('does not set HSTS on http, so local development keeps working', async () => {
    const response = await request('/');

    expect(response.headers.get('strict-transport-security')).toBeNull();
  });
});

describe('CORS', () => {
  it('allows an origin from the allowlist', async () => {
    const response = await request('/', { headers: { origin: 'http://localhost:3000' } });

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('vary')).toBe('Origin');
  });

  it('does not reflect a foreign origin', async () => {
    const response = await request('/', { headers: { origin: 'https://evil.example' } });

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers 204 for an allowed preflight and 403 for a foreign one', async () => {
    const allowed = await request('/api/pages', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000' },
    });
    const denied = await request('/api/pages', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example' },
    });

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get('access-control-allow-methods')).toContain('PATCH');
    expect(denied.status).toBe(403);
  });
});

describe('rate limit', () => {
  it('counts requests by client identifier and answers 429 with Retry-After', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '3' } });
    const headers = await authHeaders();
    headers['cf-connecting-ip'] = uniqueIp();

    for (const _ of [1, 2, 3]) {
      const ok = await request('/api/unknown', { headers }, env);
      expect(ok.status).toBe(404);
    }

    const limited = await request('/api/unknown', { headers }, env);

    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(await problemOf(limited)).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('does not limit requests from another IP', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '3' } });

    for (const _ of [1, 2, 3, 4]) {
      const ip = uniqueIp();
      const response = await request(
        '/api/unknown',
        { headers: { ...(await authHeaders()), 'cf-connecting-ip': ip } },
        env,
      );

      expect(response.status).toBe(404);
    }
  });

  it('does not limit health endpoints: monitoring must not hit 429', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '2' } });

    for (const _ of [1, 2, 3, 4, 5]) {
      const response = await request('/health', undefined, env);
      expect(response.status).toBe(200);
    }
  });

  it('identifies the client by cf-connecting-ip, not by a client header', () => {
    const withCloudflareIp = new Request('https://gateway.notio.dev/', {
      headers: { 'cf-connecting-ip': '203.0.113.1' },
    });
    const withSpoofedHeader = new Request('https://gateway.notio.dev/', {
      headers: { 'x-forwarded-for': '1.1.1.1' },
    });

    expect(clientIdentifier(withCloudflareIp)).toBe('203.0.113.1');
    expect(clientIdentifier(withSpoofedHeader)).toBe('anonymous');
  });

  it('computes the window from time, not from the request counter', () => {
    expect(currentWindow(60, 0)).toBe(0);
    expect(currentWindow(60, 59_999)).toBe(0);
    expect(currentWindow(60, 60_000)).toBe(1);
    expect(rateLimitKey('1.2.3.4', 7)).toBe('rl:7:1.2.3.4');
  });

  it('applies to all of /api/*, including unknown routes', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '3' } });
    const headers = { 'cf-connecting-ip': uniqueIp() };

    for (const _ of [1, 2, 3]) {
      await request('/api/unknown', { headers }, env);
    }

    expect((await request('/api/unknown', { headers }, env)).status).toBe(429);
  });
});

describe('configuration', () => {
  it('does not silently drop protection on invalid limits', async () => {
    const env = createEnv({ bindings: { RATE_LIMIT_MAX_REQUESTS: '0' } });

    const response = await request('/health', undefined, env);

    expect(response.status).toBe(500);
  });

  it('does not start with an invalid origin list', async () => {
    const env = createEnv({ bindings: { CORS_ALLOWED_ORIGINS: 'not-a-url' } });

    const response = await request('/', undefined, env);

    expect(response.status).toBe(500);
  });

  it('uses the default log level when the value is unknown', async () => {
    const env = createEnv({ bindings: { LOG_LEVEL: 'verbose' } });

    const response = await request('/', undefined, env);

    expect(response.status).toBe(200);
  });
});
