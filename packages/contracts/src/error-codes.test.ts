import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ERROR_CODE_BY_STATUS,
  defaultErrorCodeForStatus,
  ERROR_CODES,
  ErrorCodeSchema,
} from './error-codes';

describe('ErrorCodeSchema', () => {
  it('accepts every code from the enum', () => {
    for (const code of ERROR_CODES) {
      expect(ErrorCodeSchema.parse(code)).toBe(code);
    }
  });

  it('rejects free-form strings — it is a closed list', () => {
    expect(() => ErrorCodeSchema.parse('SOMETHING_UNKNOWN')).toThrow();
    expect(() => ErrorCodeSchema.parse('not_found')).toThrow();
  });

  it('contains no empty or duplicate values', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    expect(ERROR_CODES.every((code) => code.length > 0)).toBe(true);
  });
});

describe('defaultErrorCodeForStatus', () => {
  it('maps typical statuses to codes', () => {
    expect(defaultErrorCodeForStatus(400)).toBe('VALIDATION_ERROR');
    expect(defaultErrorCodeForStatus(401)).toBe('UNAUTHENTICATED');
    expect(defaultErrorCodeForStatus(403)).toBe('FORBIDDEN');
    expect(defaultErrorCodeForStatus(404)).toBe('NOT_FOUND');
    expect(defaultErrorCodeForStatus(409)).toBe('CONFLICT');
    expect(defaultErrorCodeForStatus(429)).toBe('RATE_LIMITED');
    expect(defaultErrorCodeForStatus(500)).toBe('INTERNAL_ERROR');
  });

  it('falls back to INTERNAL_ERROR for an unknown status', () => {
    expect(defaultErrorCodeForStatus(418)).toBe('INTERNAL_ERROR');
  });

  it('every default code is part of the enum', () => {
    for (const code of Object.values(DEFAULT_ERROR_CODE_BY_STATUS)) {
      expect(ERROR_CODES).toContain(code);
    }
  });
});
