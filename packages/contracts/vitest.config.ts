import { defineConfig } from 'vitest/config';

/**
 * Contracts are pure Zod schemas with no Workers dependencies, so they are
 * tested with plain Vitest in Node. The 80% coverage threshold is shared by
 * the whole monorepo.
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
