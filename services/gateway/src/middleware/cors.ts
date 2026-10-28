import type { MiddlewareHandler } from 'hono';
import type { GatewayConfig } from '../config';
import type { AppEnv } from '../env';

const ALLOWED_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'content-type, authorization, x-request-id, x-actor-id';
const EXPOSED_HEADERS =
  'x-request-id, x-notio-served-by, retry-after, x-ratelimit-limit, x-ratelimit-remaining, content-disposition';

/**
 * CORS by allowlist: `Access-Control-Allow-Origin` always matches a concrete
 * configured origin. Echoing the incoming header (Reflect Origin) would be a
 * hole — combined with cookies it hands any site that sends its own origin
 * cross-domain access to the session.
 */
export function corsMiddleware(config: GatewayConfig): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const origin = c.req.header('origin');
    const isAllowed = origin !== undefined && config.allowedOrigins.includes(origin);

    if (c.req.method === 'OPTIONS') {
      if (!isAllowed) {
        return new Response(null, { status: 403 });
      }

      return new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-methods': ALLOWED_METHODS,
          'access-control-allow-headers': ALLOWED_HEADERS,
          'access-control-expose-headers': EXPOSED_HEADERS,
          'access-control-max-age': '600',
          vary: 'Origin',
        },
      });
    }

    await next();

    if (isAllowed) {
      c.res.headers.set('access-control-allow-origin', origin);
      c.res.headers.set('access-control-allow-credentials', 'true');
      // Expose headers are needed on the actual response, not only on the preflight:
      // without them the client cannot read content-disposition of media files.
      c.res.headers.set('access-control-expose-headers', EXPOSED_HEADERS);
    }

    c.res.headers.append('vary', 'Origin');
  };
}
