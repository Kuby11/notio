import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ERROR_CODE_BY_STATUS,
  defaultErrorCodeForStatus,
  ERROR_CODES,
  ErrorCodeSchema,
} from './error-codes';

describe('ErrorCodeSchema', () => {
  it('принимает все коды из enum', () => {
    for (const code of ERROR_CODES) {
      expect(ErrorCodeSchema.parse(code)).toBe(code);
    }
  });

  it('отклоняет свободные строки — только закрытый список', () => {
    expect(() => ErrorCodeSchema.parse('ЧТО_ТО_НЕ_ИЗВЕСТНОЕ')).toThrow();
    expect(() => ErrorCodeSchema.parse('not_found')).toThrow();
  });

  it('не содержит пустых и дублирующихся значений', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    expect(ERROR_CODES.every((code) => code.length > 0)).toBe(true);
  });
});

describe('defaultErrorCodeForStatus', () => {
  it('сопоставляет типичные статусы с кодами', () => {
    expect(defaultErrorCodeForStatus(400)).toBe('VALIDATION_ERROR');
    expect(defaultErrorCodeForStatus(401)).toBe('UNAUTHENTICATED');
    expect(defaultErrorCodeForStatus(403)).toBe('FORBIDDEN');
    expect(defaultErrorCodeForStatus(404)).toBe('NOT_FOUND');
    expect(defaultErrorCodeForStatus(409)).toBe('CONFLICT');
    expect(defaultErrorCodeForStatus(429)).toBe('RATE_LIMITED');
    expect(defaultErrorCodeForStatus(500)).toBe('INTERNAL_ERROR');
  });

  it('откатывается к INTERNAL_ERROR для неизвестного статуса', () => {
    expect(defaultErrorCodeForStatus(418)).toBe('INTERNAL_ERROR');
  });

  it('все коды по умолчанию входят в enum', () => {
    for (const code of Object.values(DEFAULT_ERROR_CODE_BY_STATUS)) {
      expect(ERROR_CODES).toContain(code);
    }
  });
});
