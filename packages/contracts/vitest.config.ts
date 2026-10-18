import { defineConfig } from 'vitest/config';

/**
 * Контракты — чистые Zod-схемы без Workers-зависимостей, поэтому тестируются
 * обычным Vitest в Node. Порог покрытия 80% общий для всего монорепо.
 */
export default defineConfig({
  test: {
    name: '@notio/contracts',
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
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
