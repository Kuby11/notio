import { problem } from '@notio/contracts';
import { createLogger } from '@notio/observability';
import type { MiddlewareHandler } from 'hono';
import type { GatewayConfig } from '../config';
import { SERVICE_NAME } from '../constants';
import type { AppEnv } from '../env';

const KV_FAILURE_LOG = 'rate_limit_kv_unavailable';

/**
 * Идентификатор клиента для лимита.
 *
 * Cloudflare отдаёт реальный IP в `cf-connecting-ip`; заголовкам клиента
 * не доверяем — иначе лимит обходится одной сменой заголовка.
 */
export function clientIdentifier(request: Request): string {
  const connectingIp = request.headers.get('cf-connecting-ip');

  if (connectingIp) {
    return connectingIp;
  }

  const realIp = request.headers.get('x-real-ip');

  return realIp ?? 'anonymous';
}

/** Ключ фиксированного окна: окно вычисляется по времени, а не по TTL. */
export function rateLimitKey(identifier: string, windowStart: number): string {
  return `rl:${windowStart}:${identifier}`;
}

export function currentWindow(windowSeconds: number, nowMs: number): number {
  return Math.floor(nowMs / 1000 / windowSeconds);
}

/**
 * Rate limit по KV: фиксированное окно.
 *
 * KV в Workers — итогогово согласованное хранилище, поэтому параллельные
 * запросы одного клиента могут проскочить счётчик на единицу. Для защиты API
 * этого достаточно; если понадобится строгий лимит, заменяется на Durable Object.
 *
 * При недоступности KV лимитер fail-open: недоступность кеша не должна ронять API.
 */
export function rateLimitMiddleware(config: GatewayConfig): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const { maxRequests, windowSeconds } = config.rateLimit;
    const identifier = clientIdentifier(c.req.raw);
    const windowStart = currentWindow(windowSeconds, Date.now());
    const key = rateLimitKey(identifier, windowStart);
    const logger = createLogger({ service: SERVICE_NAME, level: config.logLevel });

    let current = 0;

    try {
      const stored = await c.env.RATE_LIMIT.get(key);
      current = stored === null ? 0 : Number.parseInt(stored, 10);
      current = Number.isFinite(current) ? current : 0;
    } catch (error) {
      logger.warn(KV_FAILURE_LOG, { requestId: c.get('requestId'), error });
    }

    if (current >= maxRequests) {
      const retryAfter = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);

      return problem({
        status: 429,
        code: 'RATE_LIMITED',
        detail: 'Слишком много запросов. Повторите позже.',
        requestId: c.get('requestId'),
        headers: { 'retry-after': String(retryAfter) },
      });
    }

    try {
      await c.env.RATE_LIMIT.put(key, String(current + 1), {
        // Двойное окно: ключ сам уберётся, даже если следующее окно пустое.
        expirationTtl: windowSeconds * 2,
      });
    } catch (error) {
      logger.warn(KV_FAILURE_LOG, { requestId: c.get('requestId'), error });
    }

    await next();

    // Заголовки ставим после обработчика: часть маршрутов возвращает готовый
    // Response, и заголовки, заданные через c.header() до next(), там теряются.
    c.res.headers.set('x-ratelimit-limit', String(maxRequests));
    c.res.headers.set('x-ratelimit-remaining', String(Math.max(0, maxRequests - current - 1)));
  };
}
