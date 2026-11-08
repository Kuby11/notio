import { describe, expect, it } from 'vitest';
import type { Database, DatabaseProperty } from '@notio/contracts';
import { assertValidDatabaseTitle, assertValidPropertyName, findTitleProperty } from './rules';

describe('Database domain rules', () => {
  it('validates the database title', () => {
    expect(() => assertValidDatabaseTitle('')).toThrow();
    expect(() => assertValidDatabaseTitle('   ')).toThrow();
    expect(() => assertValidDatabaseTitle('a'.repeat(501))).toThrow();
    expect(() => assertValidDatabaseTitle('Valid Title')).not.toThrow();
  });

  it('validates the property name and checks uniqueness', () => {
    const existing: DatabaseProperty[] = [
      { id: 'p1', name: 'Status', type: 'status' },
      { id: 'p2', name: 'Priority', type: 'select' },
    ];

    expect(() => assertValidPropertyName('', existing)).toThrow();
    expect(() => assertValidPropertyName('Status', existing)).toThrow('already exists');
    expect(() => assertValidPropertyName('status', existing)).toThrow('already exists');
    expect(() => assertValidPropertyName('Status', existing, 'p1')).not.toThrow();
    expect(() => assertValidPropertyName('Due Date', existing)).not.toThrow();
  });

  it('finds the title property or throws an error', () => {
    const validDb: Database = {
      id: 'db1',
      workspaceId: 'ws1',
      parentId: null,
      title: 'Db',
      isInline: false,
      isTrashed: false,
      properties: [
        { id: 'title', name: 'Name', type: 'title' },
        { id: 'status', name: 'Status', type: 'status' },
      ],
      createdBy: 'u1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    expect(findTitleProperty(validDb).id).toBe('title');

    const invalidDb = {
      ...validDb,
      properties: [{ id: 'p1', name: 'Text', type: 'text' as const }],
    };
    expect(() => findTitleProperty(invalidDb)).toThrow('title');
  });
});
