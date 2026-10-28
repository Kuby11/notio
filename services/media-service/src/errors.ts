import type { ErrorCode, ProblemError } from '@notio/contracts';

/**
 * Domain errors of the service.
 *
 * Business logic knows nothing about HTTP: it throws a typed error and the
 * route layer turns it into RFC 7807.
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

export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly code = 'FORBIDDEN' satisfies ErrorCode;
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND' satisfies ErrorCode;
}

/** File exceeds the limit of its type: 20 MB image, 50 MB video, 20 MB the rest. */
export class PayloadTooLargeError extends AppError {
  readonly status = 413;
  readonly code = 'PAYLOAD_TOO_LARGE' satisfies ErrorCode;
}

/** MIME type outside the allowlist in the contract. */
export class UnsupportedMediaTypeError extends AppError {
  readonly status = 415;
  readonly code = 'UNSUPPORTED_MEDIA_TYPE' satisfies ErrorCode;
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
