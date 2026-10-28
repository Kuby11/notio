import { HealthResponseSchema } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { selfHealth } from '../services/health-probe';

/**
 * Liveness endpoint of the gateway itself: it calls no internal services,
 * so it can be used to check the health of the public entry point.
 */
export function createHealthRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/health', (c) =>
    c.json(
      HealthResponseSchema.parse({
        status: 'ok',
        version: c.env.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        services: [selfHealth(c.env)],
      }),
      200,
    ),
  );
}
