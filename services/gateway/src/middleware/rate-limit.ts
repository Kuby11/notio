import { problem } from '@notio/contracts';
import { createLogger } from '@notio/observability';
import type { MiddlewareHandler } from 'hono';
import type { GatewayConfig } from '../config';
import { SERVICE_NAME } from '../constants';
import type { AppEnv } from '../env';

const KV_FAILURE_LOG = 'rate_limit_kv_unavailable';

/**
 * Client identifier for the limit.
 *
 * Cloudflare puts the real IP in `cf-connecting-ip`; client headers are not
 * trusted — otherwise the limit is bypassed by changing one header.
 */
export function clientIdentifier(request: Request): string {
  const connectingIp = request.headers.get('cf-connecting-ip');

  if (connectingIp) {
    return connectingIp;
  }

  const realIp = request.headers.get('x-real-ip');

  return realIp ?? 'anonymous';
}

/** Fixed-window key: the window is computed from time, not from TTL. */
export function rateLimitKey(identifier: string, windowStart: number): string {
  return `rl:${windowStart}:${identifier}`;
}

export function currentWindow(windowSeconds: number, nowMs: number): number {
  return Math.floor(nowMs / 1000 / windowSeconds);
}

/**
 * Rate limit over KV: fixed window.
 *
 * KV in Workers is eventually consistent, so parallel requests from one client
 * can slip the counter by one. That is good enough to protect the API; when a
 * strict limit is needed, swap in a Durable Object.
 *
 * When KV is unavailable the limiter fails open: an unavailable cache must not
 * take the API down.
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
        detail: 'Too many requests. Try again later.',
        requestId: c.get('requestId'),
        headers: { 'retry-after': String(retryAfter) },
      });
    }

    try {
      await c.env.RATE_LIMIT.put(key, String(current + 1), {
        // Double window: the key removes itself even if the next window is empty.
        expirationTtl: windowSeconds * 2,
      });
    } catch (error) {
      logger.warn(KV_FAILURE_LOG, { requestId: c.get('requestId'), error });
    }

    await next();

    // Headers are set after the handler: some routes return an already built
    // Response, and headers set through c.header() before next() are lost there.
    c.res.headers.set('x-ratelimit-limit', String(maxRequests));
    c.res.headers.set('x-ratelimit-remaining', String(Math.max(0, maxRequests - current - 1)));
  };
}
