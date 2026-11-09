/**
 * Transport used by the same-origin auth proxy to reach the gateway.
 *
 * In production the app and the gateway are sibling Workers on the same
 * `workers.dev` zone. Cloudflare rejects a Worker-to-Worker subrequest addressed
 * by public hostname inside the same zone (error 1042), so the proxy has to go
 * through a Service binding. Locally the gateway is a plain HTTP server on
 * localhost, where the binding does not exist (and direct fetch is the only
 * transport that works).
 */
export interface GatewayTransport {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Calls the runtime `fetch`, resolved at call time so tests can stub it. */
const directFetch: GatewayTransport = {
  fetch: (input, init) => fetch(input, init),
};

/**
 * Picks the transport for a gateway URL.
 *
 * The Service binding is preferred for any non-loopback gateway: a production
 * build must never fall back to a public subrequest, because that is what fails
 * with error 1042.
 */
export function selectGatewayTransport(
  target: URL,
  binding: GatewayTransport | undefined,
): GatewayTransport {
  if (binding && !isLoopbackHostname(target.hostname)) {
    return binding;
  }

  return directFetch;
}
