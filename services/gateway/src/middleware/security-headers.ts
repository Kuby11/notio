import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/**
 * Security-заголовки для API-ответов.
 *
 * Gateway отдаёт только JSON, поэтому CSP максимально строгий: скриптов
 * на этих ответах выполняться не должно.
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
 * Заголовки ставятся после обработчика прямо в `c.res.headers` — иначе они
 * потерялись бы на маршрутах, возвращающих готовый `Response` (например,
 * при проксировании в сервис), и API отдавался бы без защиты.
 */
export function securityHeadersMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();

    for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
      c.res.headers.set(header, value);
    }

    // HSTS ставим только на защищённом соединении: на localhost он бессмыслен
    // и способен заблокировать локальную разработку.
    if (new URL(c.req.url).protocol === 'https:') {
      c.res.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }
  };
}
