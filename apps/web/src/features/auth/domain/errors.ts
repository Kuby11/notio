/**
 * Доменные ошибки аутентификации.
 *
 * UI различает ситуации по коду, а не по тексту: текст можно менять,
 * код — часть контракта внутри приложения.
 */

export const AUTH_ERROR_CODES = [
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'EMAIL_TAKEN',
  'WEAK_PASSWORD',
  'INVALID_EMAIL',
  'RATE_LIMITED',
  'NETWORK_ERROR',
  'UNKNOWN',
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export class AuthError extends Error {
  readonly code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AuthError';
    this.code = code;
  }
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}
