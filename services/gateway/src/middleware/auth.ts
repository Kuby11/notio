import { problem } from '@notio/contracts';
import type { MiddlewareHandler } from 'hono';
import type { GatewayConfig } from '../config';
import type { AppEnv } from '../env';
import { bearerToken, getSharedJwksCache, verifyAccessToken } from './jwt';

/**
 * Routes reachable without authentication: API index, liveness, readiness,
 * plus sign-in, registration and JWKS. Everything else under `/api/*` needs a token.
 */
export const PUBLIC_PATHS = ['/', '/health', '/api/health', '/api/auth'] as const;

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => path === publicPath || path.startsWith(`${publicPath}/`),
  );
}

/**
 * Public media file reads: GET/HEAD on an unpredictable UUID.
 *
 * <img>, <video> and download links cannot send an Authorization header, so
 * access rests only on the randomness of the id (a capability URL, like Notion
 * attachments). Uploads and the rest of /api/* still require a token; the rate
 * limit applies to the public path too.
 */
export function isPublicReadPath(path: string, method: string): boolean {
  return (method === 'GET' || method === 'HEAD') && /^\/api\/media\/files\/[^/]+$/u.test(path);
}

/**
 * Resolves the user from the JWT and puts them in the request context.
 *
 * The token is verified locally against JWKS fetched from auth-service through
 * a Service Binding: no API request turns into an internal call.
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

/** Guards protected routes: without a valid token — 401 problem+json. */
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
      // The wording difference helps tell "no token" from "invalid"
      // when reading logs; it has no effect on security.
      detail: hasToken
        ? 'Token is invalid or expired. Sign in again.'
        : 'Authorization required: pass a token in the Authorization: Bearer <token> header',
      requestId: c.get('requestId'),
    });
  };
}
