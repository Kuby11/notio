import { problem } from '@notio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { GatewayConfig } from '../config';
import type { AppEnv } from '../env';
import { bearerToken, getSharedJwksCache, verifyAccessToken } from './jwt';

/**
 * Маршруты, доступные без аутентификации: индекс API, liveness, readiness,
 * а также вход, регистрация и JWKS. Всё остальное под `/api/*` требует токена.
 */
export const PUBLIC_PATHS = ['/', '/health', '/api/health', '/api/auth'] as const;

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`),
  );
}

/**
 * Определяет пользователя по JWT и кладёт его в контекст запроса.
 *
 * Токен проверяется локально по JWKS, полученному у auth-service через
 * Service Binding: ни один запрос к API не превращается во внутренний вызов.
 */
export function authenticationMiddleware(config: GatewayConfig): MiddlewareHandler<AppEnv> {
  const ttl = config.jwksCacheTtlSeconds;

  return async (c, next) => {
    const token = bearerToken(c.req.raw);

    if (token === null) {
      c.set('user', null);
      await next();
      return;
    }

    const user = await verifyAccessToken(token, c.env.AUTH_SERVICE, getSharedJwksCache(), ttl);
    c.set('user', user);
    await next();
  };
}

/** Закрывает защищённые маршруты: без валидного токена — 401 problem+json. */
export function requireAuthentication(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');

    if (user) {
      await next();
      return;
    }

    const hasToken = bearerToken(c.req.raw) !== null;

    return problem({
      status: 401,
      code: 'UNAUTHENTICATED',
      // Различие формулировок помогает отличить «нет токена» от «недействительный»
      // при разборе логов; на безопасность оно не влияет.
      detail: hasToken
        ? 'Токен недействителен или истёк. Войдите заново.'
        : 'Требуется авторизация: передайте токен в заголовке Authorization: Bearer <token>',
      requestId: c.get('requestId'),
    });
  };
}
