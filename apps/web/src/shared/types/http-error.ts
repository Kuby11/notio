/**
 * HTTP response error carrying the status.
 *
 * Network and UI distinguish 4xx from 5xx by status, not by message text:
 * for example, 429 must not be retried or the rate limit only gets worse.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
