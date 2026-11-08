import { describe, expect, it } from 'vitest';
import { createDb } from './client';

function fakeDbBinding(): D1Database {
  return {} as unknown as D1Database;
}

const schema = { pages: { name: 'pages' } } as unknown as Record<string, unknown>;

describe('createDb', () => {
  it('creates a client on top of the given D1 binding', () => {
    const db = createDb({ DB: fakeDbBinding() }, schema);

    expect(db.query).toBeDefined();
    expect(db.select).toBeTypeOf('function');
    expect(db.insert).toBeTypeOf('function');
  });

  it('accepts an environment with extra fields', () => {
    const env = { DB: fakeDbBinding(), ENVIRONMENT: 'test', SERVICE_VERSION: '0.1.0' };

    expect(() => createDb(env, schema)).not.toThrow();
  });
});
