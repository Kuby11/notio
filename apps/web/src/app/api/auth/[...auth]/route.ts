import { env } from '../../../../shared/configs/env';

/**
 * Проксирование auth-эндпоинтов на gateway.
 *
 * Сессия better-auth живёт в cookie на хосте, откуда шёл запрос. На деплое
 * web (notio-web.saab…) и gateway (notio-gateway.saab…) — разные хосты, а
 * .workers.dev — public suffix: общая cookie Domain между ними невозможна.
 * Поэтому все /api/auth/* браузер бьёт в свой же origin (как в dev, где
 * localhost делит cookie между портами), а воркер пересылает вызов на
 * gateway сервер-сайду: Set-Cookie возвращается и садится на web-origin.
 *
 * Обычное API (pages/workspaces/media) ходит на gateway напрямую с
 * Bearer-токеном — cookie там не нужна.
 */

const AUTH_PREFIX = '/api/auth';

function proxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = `${env.NEXT_PUBLIC_GATEWAY_URL}${AUTH_PREFIX}${url.pathname.slice(AUTH_PREFIX.length)}${url.search}`;

  // host/content-length пересчитываются fetch: оригинальные нельзя переносить.
  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  return fetch(target, {
    method: request.method,
    headers,
    body: request.body,
    // @ts-expect-error -- duplex нужен для стримингового body в undici-совместимых рантаймах
    duplex: 'half',
    redirect: 'manual',
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
