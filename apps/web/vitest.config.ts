import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Тесты фронтенда: домен, use cases и адаптеры работают в обычном Node,
 * компоненты — в jsdom с Testing Library.
 *
 * Покрытие меряется для слоёв domain → application → adapters → ui:
 * порог отражает качество кода, а не наличие или отсутствие DOM-тестов.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // tsconfig отдаёт jsx: preserve под Next, а Vitest разбирает .tsx сам.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    name: '@notio/web',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['./test/setup-dom.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/features/**/{domain,application,adapters,ui}/**/*.ts',
        'src/features/**/*.tsx',
      ],
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
