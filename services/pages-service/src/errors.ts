import type { ErrorCode, ProblemError } from '@notio/contracts';

/**
 * Доменные ошибки сервиса.
 *
 * Бизнес-логика ничего не знает про HTTP: она выбрасывает типизированную
 * ошибку, а слой маршрутов превращает её в RFC 7807. Никаких Response
 * в сервисном слое.
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

/** Ресурс не найден. Намеренно не различает «нет» и «нет доступа» в сообщении. */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND' satisfies ErrorCode;
}

/**
 * Доступ запрещён. Используется и для чужого workspace: по коду ответа
 * клиент не должен уметь отличить «чужой ресурс» от «несуществующего».
 */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = 'FORBIDDEN' satisfies ErrorCode;
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly code = 'CONFLICT' satisfies ErrorCode;
}

export class ServiceUnavailableError extends AppError {
  readonly status = 503;
  readonly code = 'SERVICE_UNAVAILABLE' satisfies ErrorCode;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
