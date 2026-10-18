import { describe, expect, it } from 'vitest';
import { createDb } from './client';

function fakeDbBinding(): D1Database {
  return {} as unknown as D1Database;
}

const schema = { pages: { name: 'pages' } } as unknown as Record<string, unknown>;

describe('createDb', () => {
  it('создаёт клиент поверх переданного биндинга D1', () => {
    const db = createDb({ DB: fakeDbBinding() }, schema);

    expect(db.query).toBeDefined();
    expect(db.select).toBeTypeOf('function');
    expect(db.insert).toBeTypeOf('function');
  });

  it('принимает окружение с дополнительными полями', () => {
    const env = { DB: fakeDbBinding(), ENVIRONMENT: 'test', SERVICE_VERSION: '0.1.0' };

    expect(() => createDb(env, schema)).not.toThrow();
  });
});
