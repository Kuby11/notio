import { INTERNAL_HEADERS } from '@notio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../env';

/** Допустимый вид клиентского request-id: буквы, цифры, дефис, подчёркивание. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const REQUEST_ID_HEADER = INTERNAL_HEADERS.REQUEST_ID;

export function isValidRequestId(value: string | undefined | null): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

/**
 * Сквозной request-id: принимает корректный входящий, иначе генерирует свой.
 *
 * Валидация обязательна — иначе через заголовок можно было бы подмешать
 * мусор в логи или завалить лог-агрегатор.
 *
 * Заголовок ставится **после** обработчика напрямую в `c.res.headers`: часть
 * маршрутов возвращает готовый `Response`, и заголовки, установленные через
 * `c.header()` до `next()`, в такие ответы не попадают.
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
