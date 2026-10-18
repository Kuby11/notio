import { defineConfig } from 'vitest/config';

/** Утилиты Drizzle чисты и не зависят от Workers, поэтому тестируются в Node. */
export default defineConfig({
  test: {
    name: '@notio/db',
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
