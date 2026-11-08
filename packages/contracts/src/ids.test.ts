import { describe, expect, it } from 'vitest';
import { IdSchema, newId, PositionSchema, SlugSchema } from './ids';

describe('IdSchema', () => {
  it('accepts a version 4 UUID', () => {
    expect(IdSchema.parse('9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f')).toBeDefined();
  });

  it('rejects UUIDs of other versions and invalid strings', () => {
    expect(() => IdSchema.parse('9f1c0e2a-3b4d-1c5e-8f90-1a2b3c4d5e6f')).toThrow();
    expect(() => IdSchema.parse('not-a-uuid')).toThrow();
    expect(() => IdSchema.parse('9f1c0e2a3b4d4c5e8f901a2b3c4d5e6f')).toThrow();
  });
});

describe('newId', () => {
  it('generates valid unique identifiers', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));

    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(IdSchema.safeParse(id).success).toBe(true);
    }
  });
});

describe('SlugSchema', () => {
  it('accepts slugs made of Latin letters, digits and hyphens', () => {
    expect(SlugSchema.parse('my-team-2')).toBe('my-team-2');
  });

  it('rejects spaces, uppercase letters and repeated hyphens', () => {
    expect(() => SlugSchema.parse('my team')).toThrow();
    expect(() => SlugSchema.parse('MyTeam')).toThrow();
    expect(() => SlugSchema.parse('my--team')).toThrow();
  });

  it('enforces the length bounds', () => {
    expect(() => SlugSchema.parse('a')).toThrow();
    expect(() => SlugSchema.parse('a'.repeat(65))).toThrow();
  });
});

describe('PositionSchema', () => {
  it('accepts any non-empty position string', () => {
    expect(PositionSchema.parse('a0')).toBe('a0');
    expect(PositionSchema.parse('a0V')).toBe('a0V');
  });

  it('rejects an empty position', () => {
    expect(() => PositionSchema.parse('')).toThrow();
  });
});
