import type { MiddlewareHandler } from 'hono';
import { readGatewayConfig, type GatewayConfig } from '../config';
import type { AppEnv } from '../env';

/**
 * Конфигурация зависит от биндингов, которые в Workers приходят на каждый
 * запрос, поэтому читается в middleware, а не один раз при старте.
 */
export function configMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('config', readGatewayConfig(c.env));
    await next();
  };
}

export type { GatewayConfig };
