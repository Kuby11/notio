import { HttpError } from '../types/http-error';

/**
 * Политика повторов TanStack Query.
 *
 * 4xx — ошибка запроса, а не временный сбой: повторять её бессмысленно,
 * а для 429 ещё и вредно, потому что каждый retry расходует тот же лимит.
 * Сетевые ошибки и 5xx повторяем один раз.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (error instanceof HttpError && error.status >= 400 && error.status < 500) {
    return false;
  }

  return failureCount < 1;
}
