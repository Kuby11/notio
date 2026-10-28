import { AuthError, isAuthError, type AuthErrorCode } from '../types/errors';

/**
 * Translates service responses into domain errors.
 *
 * Better Auth codes are a detail of the service implementation: the UI must not
 * know them. An unknown code becomes UNKNOWN instead of being ignored: a
 * silently swallowed sign-in error looks like "nothing happened".
 * Message texts live in messages/*.json — only codes live here.
 */

const CODE_MAP: Record<string, AuthErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: 'INVALID_CREDENTIALS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  USER_ALREADY_EXISTS: 'EMAIL_TAKEN',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'EMAIL_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  // Our own response about a taken email (problem+json, code CONFLICT).
  CONFLICT: 'EMAIL_TAKEN',
  PASSWORD_TOO_SHORT: 'WEAK_PASSWORD',
  PASSWORD_TOO_LONG: 'WEAK_PASSWORD',
  INVALID_EMAIL: 'INVALID_EMAIL',
  // Current password did not match (password change, account deletion).
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  // The account was created through OAuth and has no password to change.
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'PASSWORD_NOT_SET',
  // Sensitive operations require a session younger than the freshness window.
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_FRESH: 'SESSION_EXPIRED',
};

/** Error code for the UI to translate: message texts live in messages/*. */
export function authErrorCode(error: unknown): AuthErrorCode | null {
  return isAuthError(error) ? error.code : null;
}

export function authErrorFromStatus(status: number): AuthError {
  const code: AuthErrorCode = status === 429 ? 'RATE_LIMITED' : 'UNKNOWN';

  return new AuthError(code, code);
}

export function authErrorFromPayload(payload: {
  code?: string | undefined;
  status?: number | undefined;
}): AuthError {
  if (payload.status === 429) {
    return authErrorFromStatus(429);
  }

  const code = payload.code === undefined ? undefined : CODE_MAP[payload.code];

  return code === undefined
    ? authErrorFromStatus(payload.status ?? 500)
    : new AuthError(code, code);
}

export function networkError(cause: unknown): AuthError {
  return new AuthError('NETWORK_ERROR', 'NETWORK_ERROR', { cause });
}
