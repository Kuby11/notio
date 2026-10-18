import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

const HEALTH_PAGE = {
  status: 'ok',
  version: '0.1.0',
  timestamp: '2026-10-18T12:00:00.000Z',
  services: [{ service: 'pages-service', status: 'ok', version: '0.1.0', latencyMs: 1 }],
};

const HEALTH_AUTH = {
  status: 'ok',
  version: '0.1.0',
  timestamp: '2026-10-18T12:00:00.000Z',
  services: [{ service: 'auth-service', status: 'ok', version: '0.1.0', latencyMs: 1 }],
};

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: './src/index.ts',
      // Конфиг gateway намеренно не подключается: его Service Bindings указывают
      // на отдельные воркеры, которых в тестовом процессе нет. Поведение сервисов
      // и KV подменяются in-memory реализациями.
      miniflare: {
        compatibilityDate: '2026-10-18',
        compatibilityFlags: ['nodejs_compat'],
        bindings: {
          ENVIRONMENT: 'test',
          SERVICE_VERSION: '0.1.0',
          LOG_LEVEL: 'error',
          CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
          RATE_LIMIT_MAX_REQUESTS: '10000',
          RATE_LIMIT_WINDOW_SECONDS: '60',
          AUTH_JWKS_CACHE_TTL_SECONDS: '300',
        },
        serviceBindings: {
          PAGES_SERVICE() {
            return Response.json(HEALTH_PAGE);
          },
          AUTH_SERVICE(request) {
            const path = new URL(request.url).pathname;

            return path.includes('jwks') ? Response.json({ keys: [] }) : Response.json(HEALTH_AUTH);
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
      exclude: ['src/**/*.test.ts', 'src/types/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
