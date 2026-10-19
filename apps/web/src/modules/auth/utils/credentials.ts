/**
 * Правила учётных данных — чистый доменный слой (без React, Zod и сети).
 * Время и окружение сюда не попадают: правила детерминированы.
 */

/** Минимальная длина пароля. Совпадает с лимитом auth-service. */
export const MIN_PASSWORD_LENGTH = 12;

/** Максимальная длина пароля: длинные значения замедляют хеширование. */
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Практичный минимум для формата почты: символ@хост.название. Валидация формы
 * не заменяет проверку на сервере, но не даёт отправлять заведомый мусор.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export interface Credentials {
  email: string;
  password: string;
}

export type CredentialsField = 'email' | 'password';

export type CredentialsProblemCode = 'REQUIRED' | 'INVALID_EMAIL' | 'TOO_SHORT' | 'TOO_LONG';

export interface CredentialsProblem {
  field: CredentialsField;
  code: CredentialsProblemCode;
  message: string;
}

/**
 * Приводит почту к виду, в котором её хранит сервис.
 * Сравнение регистрозависимое email в базе создало бы дубли аккаунтов.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

/**
 * Проверяет учётные данные до похода в сеть.
 * Возвращает все проблемы сразу, чтобы форма подсветила все поля, а не по одному.
 */
export function validateCredentials(input: Credentials): CredentialsProblem[] {
  const problems: CredentialsProblem[] = [];
  const email = input.email.trim();
  const password = input.password;

  if (email.length === 0) {
    problems.push({ field: 'email', code: 'REQUIRED', message: 'Укажите почту' });
  } else if (!isValidEmail(email)) {
    problems.push({
      field: 'email',
      code: 'INVALID_EMAIL',
      message: 'Почта выглядит некорректно',
    });
  }

  if (password.length === 0) {
    problems.push({ field: 'password', code: 'REQUIRED', message: 'Укажите пароль' });
  } else if (password.length < MIN_PASSWORD_LENGTH) {
    problems.push({
      field: 'password',
      code: 'TOO_SHORT',
      message: `Пароль не короче ${MIN_PASSWORD_LENGTH} символов`,
    });
  } else if (password.length > MAX_PASSWORD_LENGTH) {
    problems.push({
      field: 'password',
      code: 'TOO_LONG',
      message: `Пароль не длиннее ${MAX_PASSWORD_LENGTH} символов`,
    });
  }

  return problems;
}
