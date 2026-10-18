import { aggregateStatus, HealthResponseSchema, healthStatusCode } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { probePagesService, selfHealth } from '../services/health-probe';

/**
 * Readiness-endpoint: опрашивает внутренние сервисы через Service Bindings
 * и отдаёт 503, если хотя бы один из них недоступен.
 */
export function createHealthApiRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/api/health', async (c) => {
    const services = [selfHealth(c.env), await probePagesService(c.env)];
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
