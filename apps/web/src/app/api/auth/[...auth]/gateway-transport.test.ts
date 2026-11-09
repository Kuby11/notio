import { describe, expect, it, vi } from 'vitest';
import { selectGatewayTransport } from './gateway-transport';

type FetchHandler = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const binding = { fetch: vi.fn<FetchHandler>(async () => new Response('binding')) };

/**
 * Choosing the wrong transport is the difference between a working sign-in and
 * a 404 in production: a public Worker-to-Worker subrequest inside one zone is
 * blocked by Cloudflare (error 1042).
 */
describe('selectGatewayTransport', () => {
  it('uses the Service binding for a deployed gateway', () => {
    const transport = selectGatewayTransport(
      new URL('https://notio-gateway.example.workers.dev/api/auth/get-session'),
      binding,
    );

    expect(transport).toBe(binding);
  });

  it('uses direct fetch for a local gateway even when a binding exists', () => {
    const transport = selectGatewayTransport(
      new URL('http://localhost:8787/api/auth/get-session'),
      binding,
    );

    expect(transport).not.toBe(binding);
    expect(typeof transport.fetch).toBe('function');
  });

  it('uses direct fetch when no binding is configured', () => {
    const transport = selectGatewayTransport(
      new URL('https://notio-gateway.example.workers.dev/api/auth/get-session'),
      undefined,
    );

    expect(transport).not.toBe(binding);
    expect(typeof transport.fetch).toBe('function');
  });

  it('treats every loopback spelling as local', () => {
    for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
      const transport = selectGatewayTransport(
        new URL(`http://${hostname}:8787/api/auth`),
        binding,
      );

      expect(transport).not.toBe(binding);
    }
  });
});
