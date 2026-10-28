import type { ErrorCode, ProblemError } from '@notio/contracts';

/**
 * Domain errors of the service.
 *
 * Business logic knows nothing about HTTP: it throws a typed error and the
 * route layer turns it into RFC 7807. No Response in the service layer.
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

/** Resource not found. Deliberately does not distinguish "absent" from "no access" in the message. */
export class NotFoundError extends AppError {
  readonly status = 404;
  readonly code = 'NOT_FOUND' satisfies ErrorCode;
}

/**
 * Access denied. Also used for a foreign workspace: by the response code the
 * client must not be able to tell "someone else's resource" from "missing".
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
