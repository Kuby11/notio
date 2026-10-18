import { defineConfig } from 'vitest/config';

/**
 * Тесты фронтенда: домен, use cases и адаптеры работают в обычном Node,
 * поэтому DOM-окружение не нужно. Компонентные тесты (Testing Library)
 * добавятся вместе с первой UI-фичей, требующей рендера.
 *
 * Покрытие меряется только для слоёв, которые тестируются сейчас: *.tsx
 * без рендера в отчёт не попадают, иначе порог отражал бы не качество кода,
 * а отсутствие DOM-тестов.
 */
export default defineConfig({
  test: {
    name: '@notio/web',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/features/**/domain/**/*.ts',
        'src/features/**/application/**/*.ts',
        'src/features/**/adapters/**/*.ts',
      ],
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
