import { HealthResponseSchema } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';

export const SERVICE_NAME = 'pages-service';

/**
 * The service's own health endpoint. Called by the gateway through a Service Binding
 * and used during local development to check the service on its own.
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
