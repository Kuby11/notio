import { createLocalJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import {
  AUTH_JWKS_PATH,
  AuthClaimsSchema,
  JsonWebKeySetSchema,
  type AuthenticatedUser,
} from '@notio/contracts';
import { DEFAULT_JWKS_TTL_SECONDS, createJwksCache, type JwksCache } from './jwks-cache';

/** Path the gateway uses to fetch JWKS from auth-service. */
export { AUTH_JWKS_PATH, DEFAULT_JWKS_TTL_SECONDS };

/**
 * Internal address for the Service Binding: the service name goes in the host,
 * the domain does not matter — only the path does. The URL must be absolute:
 * `new Request('/health')` throws Invalid URL in Workers, unlike in a browser.
 */
export const INTERNAL_ORIGIN = 'https://internal';

/** Absolute JWKS URL that the gateway calls internally, not the public internet. */
export const AUTH_JWKS_URL = `${INTERNAL_ORIGIN}${AUTH_JWKS_PATH}`;

/** Key cache at the worker isolate level. */
const sharedJwksCache: JwksCache = createJwksCache();

export function getSharedJwksCache(): JwksCache {
  return sharedJwksCache;
}

export function clearSharedJwksCache(): void {
  sharedJwksCache.clear();
}

export async function fetchJwks(
  authService: Fetcher,
  cache: JwksCache,
  ttlSeconds = DEFAULT_JWKS_TTL_SECONDS,
) {
  const cached = cache.get();

  if (cached && cached.expiresAt > Date.now()) {
    return cached.keys;
  }

  const response = await authService.fetch(new Request(AUTH_JWKS_URL));

  if (!response.ok) {
    throw new Error(`auth-service did not return JWKS: HTTP ${response.status}`);
  }

  const keys = JsonWebKeySetSchema.parse(await response.json());
  cache.set({ keys, expiresAt: Date.now() + ttlSeconds * 1000 });

  return keys;
}

/**
 * Verifies a JWT against the JWKS keys and returns the user.
 *
 * Any verification failure (signature, expiry, garbage in the token) yields
 * null — the calling middleware decides whether to let the request through,
 * so different error types stay distinguishable in logs.
 */
export async function verifyAccessToken(
  token: string,
  authService: Fetcher,
  cache: JwksCache,
  ttlSeconds?: number,
): Promise<AuthenticatedUser | null> {
  try {
    const jwks = await fetchJwks(authService, cache, ttlSeconds);
    const keySet = createLocalJWKSet(jwks as unknown as Parameters<typeof createLocalJWKSet>[0]);
    const { payload } = await jwtVerify(token, keySet as JWTVerifyGetKey);
    const sessionId = payload['sessionId'];

    const claims = AuthClaimsSchema.parse({
      ...payload,
      sub: String(payload.sub),
      exp: Number(payload.exp),
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    });

    return { id: claims.sub, claims };
  } catch {
    return null;
  }
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');

  if (!header) {
    return null;
  }

  const [scheme, value] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !value) {
    return null;
  }

  return value.trim();
}
