import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Frontend tests: domain logic and adapters run in plain Node, components run
 * in jsdom with Testing Library.
 *
 * Coverage is measured for pure module logic (`utils`): hooks and UI are
 * covered by component tests and smoke runs, and their thin wiring would
 * only distort the business-rule metric.
 *
 * The app runs on vinext, which ships the `next/*` runtime shims, so the tests
 * resolve those specifiers to the shims instead of a `next` install.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'next/headers': 'vinext/shims/headers',
      'next/image': 'vinext/shims/image',
      'next/link': 'vinext/shims/link',
      'next/navigation': 'vinext/shims/navigation',
      'next/server': 'vinext/shims/server',
      'next/font/google': 'vinext/shims/font-google',
    },
  },
  // The shared tsconfig keeps jsx: preserve, while Vitest parses .tsx itself.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: '@notio/web',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['./test/setup-dom.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/modules/**/utils/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
