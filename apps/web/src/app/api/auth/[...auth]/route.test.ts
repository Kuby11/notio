import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/**
 * The proxy is the only place that moves the session cookie onto the app host,
 * so its contract is checked directly: target URL, method, body and Set-Cookie.
 */
describe('auth proxy route', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards a read to the gateway and keeps Set-Cookie', async () => {
    const fetchMock = vi.fn<FetchHandler>(async (input) => {
      expect(String(input)).toBe('http://localhost:8787/api/auth/get-session?x=1');

      return new Response('{"session":null}', {
        status: 200,
        headers: { 'set-cookie': '__Secure-notio.session_token=abc; Path=/; HttpOnly; Secure' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(new Request('https://notio-web.example/api/auth/get-session?x=1'));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('notio.session_token');
  });

  it('forwards the method and body of a mutating endpoint', async () => {
    const fetchMock = vi.fn<FetchHandler>(async (_input, init) => {
      expect(init?.method).toBe('POST');

      const body = init?.body;

      expect(body).toBeInstanceOf(ArrayBuffer);

      const decoded = body instanceof ArrayBuffer ? new TextDecoder().decode(body) : '';

      expect(decoded).toBe('{"email":"a@b.c"}');

      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await POST(
      new Request('https://notio-web.example/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"email":"a@b.c"}',
      }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
