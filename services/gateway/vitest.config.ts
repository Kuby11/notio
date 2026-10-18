import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './src/index.ts',
      // Конфиг gateway намеренно не подключается: его Service Binding указывает
      // на отдельный воркер, которого в тестовом процессе нет. Поведение
      // сервиса и KV подменяются in-memory реализациями.
      miniflare: {
        compatibilityDate: '2026-10-18',
        compatibilityFlags: ['nodejs_compat'],
        bindings: {
          ENVIRONMENT: 'test',
          SERVICE_VERSION: '0.1.0',
          LOG_LEVEL: 'error',
          CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
          RATE_LIMIT_MAX_REQUESTS: '3',
          RATE_LIMIT_WINDOW_SECONDS: '60',
        },
        serviceBindings: {
          PAGES_SERVICE() {
            return new Response('not-configured', { status: 503 });
          },
        },
        kvNamespaces: ['RATE_LIMIT'],
      },
    }),
  ],
  test: {
    name: '@notio/gateway',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
