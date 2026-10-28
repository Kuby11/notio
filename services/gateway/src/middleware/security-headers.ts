import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/**
 * Security headers for API responses.
 *
 * The gateway only serves JSON, so CSP is as strict as possible: no scripts
 * should execute on these responses.
 */
const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'cross-origin-resource-policy': 'same-site',
  'permissions-policy': 'geolocation=(), camera=(), microphone=()',
};

/**
 * Headers are applied after the handler directly on `c.res.headers` — otherwise
 * they would be lost on routes returning an already built `Response` (for
 * example when proxying to a service), and the API would ship unprotected.
 */
export function securityHeadersMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      c.res.headers.set(header, value);
    }

    // HSTS is set only on a secure connection: on localhost it is pointless
    // and can lock local development.
    if (new URL(c.req.url).protocol === 'https:') {
      c.res.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
  };
}
