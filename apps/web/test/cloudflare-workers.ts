/**
 * Vitest stand-in for the Workers runtime module `cloudflare:workers`.
 *
 * The app only reads worker bindings from it. Tests that exercise the real
 * Service binding may assign `env.GATEWAY`; everything else sees `undefined`
 * and falls back to the plain `fetch` transport, exactly like local dev.
 */
export interface TestGatewayBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export const env: { GATEWAY?: TestGatewayBinding } = {};
export const exports = {};
