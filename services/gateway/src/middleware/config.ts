import type { MiddlewareHandler } from 'hono';
import { readGatewayConfig, type GatewayConfig } from '../config';
import type { AppEnv } from '../env';

/**
 * The configuration depends on bindings, which Workers supply per request,
 * so it is read in middleware rather than once at startup.
 */
export function configMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('config', readGatewayConfig(c.env));
    await next();
  };
}

export type { GatewayConfig };
