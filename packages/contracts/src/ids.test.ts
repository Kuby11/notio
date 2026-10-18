import { describe, expect, it } from 'vitest';
import { IdSchema, newId, PositionSchema, SlugSchema } from './ids';

describe('IdSchema', () => {
  it('принимает UUID версии 4', () => {
    expect(IdSchema.parse('9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f')).toBeDefined();
  });

  it('отклоняет UUID другой версии и невалидные строки', () => {
    expect(() => IdSchema.parse('9f1c0e2a-3b4d-1c5e-8f90-1a2b3c4d5e6f')).toThrow();
    expect(() => IdSchema.parse('not-a-uuid')).toThrow();
    expect(() => IdSchema.parse('9f1c0e2a3b4d4c5e8f901a2b3c4d5e6f')).toThrow();
  });
});

describe('newId', () => {
  it('выдаёт валидные уникальные идентификаторы', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId()));

    expect(ids.size).toBe(100);
    for (const id of ids) {
      expect(IdSchema.safeParse(id).success).toBe(true);
    }
  });
});

describe('SlugSchema', () => {
  it('принимает slug из латиницы, цифр и дефисов', () => {
    expect(SlugSchema.parse('my-team-2')).toBe('my-team-2');
  });

  it('отклоняет пробелы, заглавные буквы и повторные дефисы', () => {
    expect(() => SlugSchema.parse('my team')).toThrow();
    expect(() => SlugSchema.parse('MyTeam')).toThrow();
    expect(() => SlugSchema.parse('my--team')).toThrow();
  });

  it('ограничивает длину', () => {
    expect(() => SlugSchema.parse('a')).toThrow();
    expect(() => SlugSchema.parse('a'.repeat(65))).toThrow();
  });
});

describe('PositionSchema', () => {
  it('принимает любую непустую строку позиции', () => {
    expect(PositionSchema.parse('a0')).toBe('a0');
    expect(PositionSchema.parse('a0V')).toBe('a0V');
  });

  it('отклоняет пустую позицию', () => {
    expect(() => PositionSchema.parse('')).toThrow();
  });
});
