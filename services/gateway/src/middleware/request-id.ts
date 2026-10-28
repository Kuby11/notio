import { INTERNAL_HEADERS } from '@notio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/** Allowed shape of a client request-id: letters, digits, hyphen, underscore. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const REQUEST_ID_HEADER = INTERNAL_HEADERS.REQUEST_ID;

export function isValidRequestId(value: string | undefined | null): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

/**
 * End-to-end request-id: accepts a valid incoming one, otherwise generates its own.
 *
 * Validation is mandatory — otherwise garbage could be injected into the logs
 * through the header, or a log aggregator flooded.
 *
 * The header is set **after** the handler directly on `c.res.headers`: some
 * routes return an already built `Response`, and headers set through
 * `c.header()` before `next()` never reach those responses.
 */
export function requestIdMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incoming = c.req.header(REQUEST_ID_HEADER);
    const requestId = isValidRequestId(incoming) ? incoming : crypto.randomUUID();

    c.set('requestId', requestId);
    await next();
    c.res.headers.set(REQUEST_ID_HEADER, requestId);
  };
}
