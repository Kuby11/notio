import { HealthResponseSchema } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const SERVICE_NAME = 'pages-service';

/**
 * Собственный health-эндпоинт сервиса. Вызывается gateway'ем через Service Binding
 * и используется в локальной разработке для проверки сервиса отдельно.
 */
export function createHealthRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/health', (c) =>
    c.json(
      HealthResponseSchema.parse({
        status: 'ok',
        version: c.env.SERVICE_VERSION,
        timestamp: new Date().toISOString(),
        services: [
          {
            service: SERVICE_NAME,
            status: 'ok',
            version: c.env.SERVICE_VERSION,
            latencyMs: 0,
          },
        ],
      }),
      200,
    ),
  );
}
