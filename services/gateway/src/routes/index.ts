import { ServiceIndexSchema } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';

/**
 * Public API index. Answers on the root so that hitting the gateway address
 * describes the service instead of returning 404.
 */
export function createIndexRoutes(): Hono<AppEnv> {
  return new Hono<AppEnv>().get('/', (c) =>
    c.json(
      ServiceIndexSchema.parse({
        name: 'notio',
        version: c.env.SERVICE_VERSION,
        endpoints: [
          { method: 'GET', path: '/', description: 'Индекс API' },
          { method: 'GET', path: '/health', description: 'Liveness самого gateway' },
          {
            method: 'GET',
            path: '/api/health',
            description: 'Readiness: gateway и внутренние сервисы',
          },
        ],
      }),
      200,
    ),
  );
}
