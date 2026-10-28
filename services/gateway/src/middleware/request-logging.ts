import { createLogger } from '@notio/observability';
import type { MiddlewareHandler } from 'hono';
import type { GatewayConfig } from '../config';
import { SERVICE_NAME } from '../constants';
import type { AppEnv } from '../env';

/**
 * Logs every request: method, path, status, duration and request-id.
 * Request bodies and authorization headers are never logged — metadata only.
 */
export function requestLoggingMiddleware(config: GatewayConfig): MiddlewareHandler<AppEnv> {
  const logger = createLogger({ service: SERVICE_NAME, level: config.logLevel });

  return async (c, next) => {
    const startedAt = Date.now();

    try {
      await next();
    } finally {
      logger.info('request', {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs: Date.now() - startedAt,
      });
    }
  };
}
