import { aggregateStatus, HealthResponseSchema, healthStatusCode } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { collectHealth } from '../services/health-probe';

/**
 * Readiness endpoint: probes the internal services through Service Bindings
 * and answers 503 if any of them is down.
 */
export function createHealthApiRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/api/health', async (c) => {
    const services = await collectHealth(c.env);
    const status = aggregateStatus(services);

    return c.json(
      HealthResponseSchema.parse({
        status,
        version: c.env.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        services,
      }),
      healthStatusCode(status),
    );
  });
}
