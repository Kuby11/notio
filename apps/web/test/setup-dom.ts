import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Общая настройка DOM-тестов: очистка размонтированных деревьев между
 * тестами и матчеры jest-dom для доступных имён ролей и текста.
 */
afterEach(() => {
  cleanup();
});
