import { AuthError, type AuthErrorCode } from '../domain';

/**
 * Перевод ответов сервиса в доменные ошибки.
 *
 * Коды Better Auth — деталь реализации сервиса: UI их знать не должен.
 * Неизвестный код превращается в UNKNOWN, а не игнорируется: молча
 * проглоченная ошибка входа выглядит как «ничего не произошло».
 */

const CODE_MAP: Record<string, AuthErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: 'INVALID_CREDENTIALS',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  USER_ALREADY_EXISTS: 'EMAIL_TAKEN',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'EMAIL_TAKEN',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  // Наш собственный ответ о занятом email (problem+json, код CONFLICT).
  CONFLICT: 'EMAIL_TAKEN',
  PASSWORD_TOO_SHORT: 'WEAK_PASSWORD',
  PASSWORD_TOO_LONG: 'WEAK_PASSWORD',
  INVALID_EMAIL: 'INVALID_EMAIL',
};

const MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_CREDENTIALS: 'Неверная почта или пароль',
  EMAIL_NOT_VERIFIED: 'Подтвердите почту по ссылке из письма',
  EMAIL_TAKEN: 'Аккаунт с такой почтой уже существует',
  WEAK_PASSWORD: 'Пароль слишком короткий или длинный',
  INVALID_EMAIL: 'Почта выглядит некорректно',
  RATE_LIMITED: 'Слишком много попыток. Попробуйте позже',
  NETWORK_ERROR: 'Сервис недоступен. Проверьте соединение',
  UNKNOWN: 'Не удалось выполнить вход. Попробуйте снова',
};

export function messageFor(code: AuthErrorCode): string {
  return MESSAGES[code];
}

export function authErrorFromStatus(status: number): AuthError {
  const code: AuthErrorCode = status === 429 ? 'RATE_LIMITED' : 'UNKNOWN';

  return new AuthError(code, messageFor(code));
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
    : new AuthError(code, messageFor(code));
}

export function networkError(cause: unknown): AuthError {
  return new AuthError('NETWORK_ERROR', messageFor('NETWORK_ERROR'), { cause });
}
