import { describe, expect, it } from 'vitest';
import { HttpError } from '../types/http-error';
import { shouldRetryQuery } from './query-policy';

describe('shouldRetryQuery', () => {
  it('не повторяет 429 и другие клиентские ошибки', () => {
    expect(shouldRetryQuery(0, new HttpError(429, 'Слишком много запросов'))).toBe(false);
    expect(shouldRetryQuery(0, new HttpError(401, 'Требуется авторизация'))).toBe(false);
    expect(shouldRetryQuery(0, new HttpError(404, 'Не найдено'))).toBe(false);
  });

  it('повторяет временные ошибки ровно один раз', () => {
    expect(shouldRetryQuery(0, new HttpError(503, 'Сервис недоступен'))).toBe(true);
    expect(shouldRetryQuery(1, new HttpError(503, 'Сервис недоступен'))).toBe(false);
  });

  it('повторяет сетевые ошибки один раз', () => {
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(shouldRetryQuery(1, new TypeError('Failed to fetch'))).toBe(false);
  });
});
