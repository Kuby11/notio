import { describe, expect, it } from 'vitest';
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  isValidEmail,
  normalizeEmail,
  validateCredentials,
} from './credentials';
import { AUTH_ERROR_CODES, AuthError, isAuthError } from '../types/errors';

describe('normalizeEmail', () => {
  it('убирает пробелы и приводит к нижнему регистру', () => {
    expect(normalizeEmail('  User@Notio.Test ')).toBe('user@notio.test');
  });

  it('одинаково нормализует разные написания одной почты', () => {
    expect(normalizeEmail('A@B.io')).toBe(normalizeEmail('a@b.io'));
  });
});

describe('isValidEmail', () => {
  it('принимает обычные адреса', () => {
    expect(isValidEmail('user@notio.dev')).toBe(true);
    expect(isValidEmail('first.last+tag@mail.notio.dev')).toBe(true);
  });

  it('отклоняет то, что почтой не является', () => {
    expect(isValidEmail('user')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('user@notio')).toBe(false);
    expect(isValidEmail('user @notio.dev')).toBe(false);
  });
});

describe('validateCredentials', () => {
  it('принимает корректные данные', () => {
    expect(
      validateCredentials({ email: 'user@notio.dev', password: 'correct-horse-battery' }),
    ).toEqual([]);
  });

  it('требует заполнить пустые поля', () => {
    const problems = validateCredentials({ email: '   ', password: '' });

    expect(problems.map((problem) => problem.field).toSorted()).toEqual(['email', 'password']);
    expect(problems.every((problem) => problem.code === 'REQUIRED')).toBe(true);
  });

  it('отмечает некорректную почту', () => {
    expect(
      validateCredentials({ email: 'nope', password: 'correct-horse-battery' }),
    ).toContainEqual({
      field: 'email',
      code: 'INVALID_EMAIL',
      message: 'Почта выглядит некорректно',
    });
  });

  it('держит нижнюю границу длины пароля', () => {
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

  it('держит верхнюю границу длины пароля', () => {
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

  it('возвращает все проблемы сразу, а не по одной', () => {
    expect(validateCredentials({ email: 'nope', password: 'short' })).toHaveLength(2);
  });
});

describe('доменные ошибки аутентификации', () => {
  it('хранит код и текст ошибки', () => {
    const error = new AuthError('EMAIL_NOT_VERIFIED', 'Подтвердите почту');

    expect(error.code).toBe('EMAIL_NOT_VERIFIED');
    expect(error.name).toBe('AuthError');
    expect(error.message).toBe('Подтвердите почту');
  });

  it('отличает доменную ошибку от прочих', () => {
    expect(isAuthError(new AuthError('UNKNOWN', 'что-то'))).toBe(true);
    expect(isAuthError(new Error('что-то'))).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });

  it('задаёт закрытый список кодов', () => {
    expect(AUTH_ERROR_CODES).toContain('RATE_LIMITED');
    expect(AUTH_ERROR_CODES).not.toContain('WHATEVER');
  });
});
