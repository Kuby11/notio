import { describe, expect, it } from 'vitest';
import { APP_NAME, HTTP_METHODS, ServiceIndexSchema } from './service-index';

const index = {
  name: APP_NAME,
  version: '0.1.0',
  endpoints: [
    { method: 'GET' as const, path: '/', description: 'API index' },
    { method: 'GET' as const, path: '/api/health', description: 'Readiness' },
  ],
};

describe('ServiceIndexSchema', () => {
  it('accepts a valid index', () => {
    expect(ServiceIndexSchema.parse(index)).toEqual(index);
  });

  it('pins the application name', () => {
    expect(APP_NAME).toBe('notio');
    expect(() => ServiceIndexSchema.parse({ ...index, name: 'notio-clone' })).toThrow();
  });

  it('requires paths starting with /', () => {
    expect(() =>
      ServiceIndexSchema.parse({
        ...index,
        endpoints: [{ method: 'GET', path: 'api/health', description: 'no slash' }],
      }),
    ).toThrow();
  });

  it('rejects an unknown HTTP method', () => {
    expect(() =>
      ServiceIndexSchema.parse({
        ...index,
        endpoints: [{ method: 'TRACE', path: '/', description: 'unsupported' }],
      }),
    ).toThrow();
  });

  it('types methods as a literal union', () => {
    expect(HTTP_METHODS).toEqual(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  });
});
