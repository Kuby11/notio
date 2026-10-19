import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Тесты фронтенда: домен, use cases и адаптеры работают в обычном Node,
 * компоненты — в jsdom с Testing Library.
 *
 * Покрытие меряется для чистой логики модулей (`hooks/use-cases` и `utils`):
 * фасады и UI-компоненты проверяются компонентными тестами, а их тонкая
 * обвязка не искажает метрику бизнес-правил.
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
      include: ['src/modules/**/hooks/use-cases/**/*.ts', 'src/modules/**/utils/**/*.ts'],
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
