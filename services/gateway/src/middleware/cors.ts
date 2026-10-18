import type { MiddlewareHandler } from 'hono';
import type { GatewayConfig } from '../config';
import type { AppEnv } from '../env';

const ALLOWED_METHODS = 'GET, POST, PATCH, PUT, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'content-type, authorization, x-request-id, x-actor-id';
const EXPOSED_HEADERS =
  'x-request-id, x-notio-served-by, retry-after, x-ratelimit-limit, x-ratelimit-remaining';

/**
 * CORS по allowlist: значение `Access-Control-Allow-Origin` всегда совпадает
 * с конкретным origin из конфига. Подстановка заголовка «как пришло» (Reflect
 * Origin) была бы дырой — вместе с куками она даёт кросс-доменный доступ
 * к сессии любому сайту, который пришлёт свой origin.
 */
export function corsMiddleware(config: GatewayConfig): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const origin = c.req.header('origin');
    const isAllowed = origin !== undefined && config.allowedOrigins.includes(origin);

    if (c.req.method === 'OPTIONS') {
      // Префлайт отвечаем только для разрешённого origin.
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
    }

    c.res.headers.append('vary', 'Origin');
  };
}
