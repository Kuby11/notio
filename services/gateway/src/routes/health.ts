import { HealthResponseSchema } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { selfHealth } from '../services/health-probe';

/**
 * Liveness-endpoint самого gateway: не вызывает внутренние сервисы,
 * чтобы по нему можно было проверять живость публичной точки входа.
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
