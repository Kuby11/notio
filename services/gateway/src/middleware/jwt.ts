import { createLocalJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import {
  AUTH_JWKS_PATH,
  AuthClaimsSchema,
  JsonWebKeySetSchema,
  type AuthenticatedUser,
} from '@notio/contracts';
import { DEFAULT_JWKS_TTL_SECONDS, createJwksCache, type JwksCache } from './jwks-cache';

/** Путь, по которому gateway получает JWKS у auth-service. */
export { AUTH_JWKS_PATH, DEFAULT_JWKS_TTL_SECONDS };

/**
 * Внутренний адрес для Service Binding: имя сервиса в хосте, домен значения
 * не имеет — важен путь. URL должен быть абсолютным: `new Request('/health')`
 * в Workers бросает Invalid URL, в отличие от браузера.
 */
export const INTERNAL_ORIGIN = 'https://internal';

/** Абсолютный URL JWKS, по которому gateway ходит внутрь, а не в интернет. */
export const AUTH_JWKS_URL = `${INTERNAL_ORIGIN}${AUTH_JWKS_PATH}`;

/** Кеш ключей на уровне изолята воркера. */
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
    throw new Error(`auth-service не отдал JWKS: HTTP ${response.status}`);
  }

  const keys = JsonWebKeySetSchema.parse(await response.json());
  cache.set({ keys, expiresAt: Date.now() + ttlSeconds * 1000 });

  return keys;
}

/**
 * Проверяет JWT по ключам JWKS и достаёт пользователя.
 *
 * Любая ошибка проверки (подпись, срок, мусор в токене) приводит к null —
 * решение «пустить или не пустить» принимает вызывающий middleware,
 * чтобы ошибки разных типов можно было различать в логах.
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

/** Достаёт токен из заголовка Authorization: Bearer <jwt>. */
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
