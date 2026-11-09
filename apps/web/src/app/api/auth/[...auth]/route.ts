import { env as workerEnv } from 'cloudflare:workers';
import { env } from '../../../../shared/configs/env';
import { selectGatewayTransport } from './gateway-transport';

/**
 * Same-origin proxy for the authentication endpoints.
 *
 * In production the web app (notio-web.<account>.workers.dev) and the gateway
 * (notio-gateway.<account>.workers.dev) are sibling hosts, and workers.dev is
 * on the Public Suffix List: a cookie with `Domain=<account>.workers.dev` is
 * rejected by the browser. The gateway callback therefore could not set a
 * session cookie the web app would ever see, and every authenticated
 * navigation bounced back to /login.
 *
 * All /api/auth/* calls go to the web origin instead and this handler forwards
 * them to the gateway server-side, so `Set-Cookie` lands on the app host. The
 * rest of the API (pages/workspaces/media) still talks to the gateway directly
 * with a Bearer token: those calls need no cookie.
 */

const AUTH_PREFIX = '/api/auth';

async function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = new URL(
    `${env.NEXT_PUBLIC_GATEWAY_URL}${AUTH_PREFIX}${url.pathname.slice(AUTH_PREFIX.length)}${url.search}`,
  );

  // host and content-length are recomputed by fetch: the originals are not
  // valid for the new request.
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  // The gateway is reached through a Service binding in production: a public
  // subrequest between Workers on the same zone is blocked (error 1042).
  return selectGatewayTransport(target, workerEnv.GATEWAY).fetch(target, {
    method: request.method,
    headers,
    body: hasBody ? await request.arrayBuffer() : null,
    // A redirect after the OAuth callback must reach the browser as is: fetch
    // following it would swallow the session cookie and hide the final URL.
    redirect: 'manual',
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
