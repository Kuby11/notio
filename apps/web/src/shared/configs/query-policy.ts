import { HttpError } from '../types/http-error';

/**
 * TanStack Query retry policy.
 *
 * 4xx is a request error, not a transient failure: retrying is pointless,
 * and for 429 it is harmful because every retry spends the same quota.
 * Network errors and 5xx are retried once.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
    return false;
  }

  return failureCount < 1;
}
