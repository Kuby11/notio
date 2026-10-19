/**
 * Правила учётных данных — чистый доменный слой (без React, Zod и сети).
 * Время и окружение сюда не попадают: правила детерминированы.
 *
 * Функции `assert*` — входная проверка для хуков: падают доменной ошибкой,
 * чтобы форма показала точный текст, а сеть не получала заведомый мусор.
 */
import { AuthError } from '../types/errors';

/** Минимальная длина пароля. Совпадает с лимитом auth-service. */
export const MIN_PASSWORD_LENGTH = 12;

/** Максимальная длина пароля: длинные значения замедляют хеширование. */
export const MAX_PASSWORD_LENGTH = 128;

/** Минимальная длина имени пользователя. */
export const MIN_NAME_LENGTH = 2;

/**
 * Практичный минимум для формата почты: символ@хост.название. Валидация формы
 * не заменяет проверку на сервере, но не даёт отправлять заведомый мусор.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

export interface Credentials {
  email: string;
  password: string;
}

export interface SignUpInput extends Credentials {
  name: string;
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

/**
 * Нормализует данные так же, как регистрация: иначе пользователь с другим
 * регистром почты вводил бы верный пароль и получал отказ.
 */
export function normalizeCredentials(input: Credentials): Credentials {
  return { email: normalizeEmail(input.email), password: input.password };
}

/**
 * Нормализует и проверяет данные входа.
 *
 * Пароль короче лимита при входе — это не «слабый пароль», а «неверные
 * данные»: код не подсказывает длину чужого пароля.
 */
export function assertSignInCredentials(input: Credentials): Credentials {
  const credentials = normalizeCredentials(input);
  const problem = validateCredentials(credentials)[0];

  if (problem !== undefined) {
    throw new AuthError(
      problem.code === 'INVALID_EMAIL' ? 'INVALID_EMAIL' : 'INVALID_CREDENTIALS',
      problem.message,
    );
  }

  return credentials;
}

/** Нормализует и проверяет данные регистрации до похода в сеть. */
export function assertSignUpInput(input: SignUpInput): SignUpInput {
  const name = input.name.trim();

  if (name.length < MIN_NAME_LENGTH) {
    throw new AuthError('UNKNOWN', `Имя не короче ${MIN_NAME_LENGTH} символов`);
  }

  const credentials = normalizeCredentials(input);
  const problem = validateCredentials(credentials)[0];

  if (problem !== undefined) {
    throw new AuthError('UNKNOWN', problem.message);
  }

  return { ...credentials, name };
}
