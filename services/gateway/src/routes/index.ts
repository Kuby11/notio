import { ServiceIndexSchema } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';

/**
 * Индекс публичного API. Отвечает на корень, чтобы обращение к адресу
 * gateway давало описание сервиса, а не 404.
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
