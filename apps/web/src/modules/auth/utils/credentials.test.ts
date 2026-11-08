import { describe, expect, it } from 'vitest';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  assertSignInCredentials,
  assertSignUpInput,
  isValidEmail,
  normalizeCredentials,
  normalizeEmail,
  validateCredentials,
} from './credentials';
import { AUTH_ERROR_CODES, AuthError, isAuthError } from '../types/errors';

/** Code of the domain error the function threw: assert on code, not on text. */
function codeOf(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return isAuthError(error) ? error.code : undefined;
  }
}

describe('normalizeEmail', () => {
  it('trims whitespace and lowercases the email', () => {
    expect(normalizeEmail('  User@Notio.Test ')).toBe('user@notio.test');
  });

  it('normalises different spellings of the same email identically', () => {
    expect(normalizeEmail('A@B.io')).toBe(normalizeEmail('a@b.io'));
  });
});

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isValidEmail('user@notio.dev')).toBe(true);
    expect(isValidEmail('first.last+tag@mail.notio.dev')).toBe(true);
  });

  it('rejects values that are not an email', () => {
    expect(isValidEmail('user')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@notio')).toBe(false);
    expect(isValidEmail('user @notio.dev')).toBe(false);
  });
});

describe('validateCredentials', () => {
  it('accepts valid credentials', () => {
    expect(
      validateCredentials({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).toEqual([]);
  });

  it('requires the empty fields to be filled in', () => {
    const problems = validateCredentials({ email: '   ', password: '' });

    expect(problems.map((problem) => problem.field).toSorted()).toEqual(['email', 'password']);
    expect(problems.every((problem) => problem.code === 'REQUIRED')).toBe(true);
  });

  it('flags an invalid email', () => {
    expect(
      validateCredentials({ email: 'nope', password: 'correct-horse-battery' }),
    ).toContainEqual({
      field: 'email',
      code: 'INVALID_EMAIL',
      message: expect.any(String),
    });
  });

  it('enforces the lower bound of the password length', () => {
    const tooShort = validateCredentials({
      email: 'user@notio.dev',
      password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
    });
    const boundary = validateCredentials({
      email: 'user@notio.dev',
      password: 'a'.repeat(MIN_PASSWORD_LENGTH),
    });

    expect(tooShort[0]?.code).toBe('TOO_SHORT');
    expect(boundary).toEqual([]);
  });

  it('enforces the upper bound of the password length', () => {
    const tooLong = validateCredentials({
      email: 'user@notio.dev',
      password: 'a'.repeat(MAX_PASSWORD_LENGTH + 1),
    });
    const boundary = validateCredentials({
      email: 'user@notio.dev',
      password: 'a'.repeat(MAX_PASSWORD_LENGTH),
    });

    expect(tooLong[0]?.code).toBe('TOO_LONG');
    expect(boundary).toEqual([]);
  });

  it('returns all problems at once, not one at a time', () => {
    expect(validateCredentials({ email: 'nope', password: 'short' })).toHaveLength(2);
  });
});

describe('normalizeCredentials', () => {
  it('normalises the email and leaves the password untouched', () => {
    expect(
      normalizeCredentials({ email: ' User@Notio.DEV ', password: 'correct-horse-battery' }),
    ).toEqual({ email: 'user@notio.dev', password: 'correct-horse-battery' });
  });
});

describe('assertSignInCredentials', () => {
  it('normalises the email before sign-in', () => {
    expect(
      assertSignInCredentials({ email: ' USER@notio.dev ', password: 'correct-horse-battery' }),
    ).toEqual({ email: 'user@notio.dev', password: 'correct-horse-battery' });
  });

  it('does not treat a short password at sign-in as a weak password', () => {
    expect(
      codeOf(() => assertSignInCredentials({ email: 'user@notio.dev', password: 'short' })),
    ).toBe('INVALID_CREDENTIALS');
  });

  it('distinguishes an invalid email', () => {
    expect(
      codeOf(() => assertSignInCredentials({ email: 'nope', password: 'correct-horse-battery' })),
    ).toBe('INVALID_EMAIL');
  });
});

describe('assertSignUpInput', () => {
  it('trims the name and normalises the email', () => {
    expect(
      assertSignUpInput({
        name: ' Anna ',
        email: ' User@Notio.DEV ',
        password: 'correct-horse-battery',
      }),
    ).toEqual({ name: 'Anna', email: 'user@notio.dev', password: 'correct-horse-battery' });
  });

  it('rejects a name that is too short', () => {
    expect(() =>
      assertSignUpInput({
        name: ' ',
        email: 'user@notio.dev',
        password: 'correct-horse-battery',
      }),
    ).toThrowError(/Name/);
  });

  it('rejects invalid credentials', () => {
    expect(
      codeOf(() => assertSignUpInput({ name: 'Anna', email: 'nope', password: 'short' })),
    ).toBe('UNKNOWN');
  });
});

describe('auth domain errors', () => {
  it('keeps the error code and message', () => {
    const error = new AuthError('EMAIL_NOT_VERIFIED', 'Confirm your email');

    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(error.name).toBe('AuthError');
    expect(error.message).toBe('Confirm your email');
  });

  it('tells a domain error apart from other errors', () => {
    expect(isAuthError(new AuthError('UNKNOWN', 'something'))).toBe(true);
    expect(isAuthError(new Error('something'))).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });

  it('defines a closed list of codes', () => {
    expect(AUTH_ERROR_CODES).toContain('RATE_LIMITED');
    expect(AUTH_ERROR_CODES).not.toContain('WHATEVER');
  });
});
