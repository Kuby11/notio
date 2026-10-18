import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const migrationsPath = path.join(import.meta.dirname, 'migrations');

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      // Конфиг сервиса даёт настоящие биндинги (в том числе локальную D1),
      // миграции читаются из репозитория — база в тестах ровно та же,
      // что и в локальной разработке.
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(migrationsPath),
        },
        serviceBindings: {
          // Каталог пользователей живёт в auth-service; в тестах отдаём
          // заранее известные профили, чтобы сценарии не зависели от соседа.
          AUTH_SERVICE(request) {
            const ids = (new URL(request.url).searchParams.get('ids') ?? '')
              .split(',')
              .filter((id) => id.length > 0);

            const items = ids.map((id) => ({
              id,
              email: `${id}@notio.test`,
              name: `Участник ${id.slice(0, 4)}`,
            }));

            return Response.json({ items });
          },
        },
      },
    })),
  ],
  test: {
    name: '@notio/workspace-service',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    setupFiles: ['./test/apply-migrations.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
