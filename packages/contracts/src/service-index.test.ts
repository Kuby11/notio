import { describe, expect, it } from 'vitest';
import { APP_NAME, HTTP_METHODS, ServiceIndexSchema } from './service-index';

const index = {
  name: APP_NAME,
  version: '0.1.0',
  endpoints: [
    { method: 'GET' as const, path: '/', description: 'Индекс API' },
    { method: 'GET' as const, path: '/api/health', description: 'Readiness' },
  ],
};

describe('ServiceIndexSchema', () => {
  it('принимает корректный индекс', () => {
    expect(ServiceIndexSchema.parse(index)).toEqual(index);
  });

  it('фиксирует имя приложения', () => {
    expect(APP_NAME).toBe('notio');
    expect(() => ServiceIndexSchema.parse({ ...index, name: 'notio-clone' })).toThrow();
  });

  it('требует пути, начинающегося с /', () => {
    expect(() =>
      ServiceIndexSchema.parse({
        ...index,
        endpoints: [{ method: 'GET', path: 'api/health', description: 'нет слеша' }],
      }),
    ).toThrow();
  });

  it('отклоняет неизвестный HTTP-метод', () => {
    expect(() =>
      ServiceIndexSchema.parse({
        ...index,
        endpoints: [{ method: 'TRACE', path: '/', description: 'не поддерживается' }],
      }),
    ).toThrow();
  });

  it('типизирует методы как литеральное объединение', () => {
    expect(HTTP_METHODS).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  });
});
