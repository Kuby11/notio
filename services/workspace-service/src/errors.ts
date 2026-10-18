import type { ErrorCode, ProblemError } from '@notio/contracts';

/**
 * Доменные ошибки сервиса.
 *
 * Бизнес-логика ничего не знает про HTTP: она выбрасывает типизированную
 * ошибку, а слой маршрутов превращает её в RFC 7807.
 */
export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly code: ErrorCode;
  readonly errors?: ProblemError[];

  constructor(message: string, options?: { errors?: ProblemError[]; cause?: unknown }) {
    super(message, { cause: options?.cause });
    this.name = new.target.name;
    this.errors = options?.errors;
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly code = 'VALIDATION_ERROR' satisfies ErrorCode;
}

/**
 * Ресурс не найден или недоступен.
 *
 * Намеренно не различает эти случаи: иначе по коду ответа можно было бы
 * перебором узнать, какие workspace существуют (IDOR-разведка).
 */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND' satisfies ErrorCode;
}

/** Действие запрещено ролью пользователя. */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = 'FORBIDDEN' satisfies ErrorCode;
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = 'CONFLICT' satisfies ErrorCode;
}

/** Ссылка-приглашение истекла или уже использована. */
export class InvitationError extends AppError {
  readonly status = 410;
  readonly code = 'CONFLICT' satisfies ErrorCode;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
