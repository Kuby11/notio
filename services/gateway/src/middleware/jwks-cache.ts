import type { JsonWebKeySet } from '@notio/contracts';

/** Сколько живёт кеш ключей по умолчанию. */
export const DEFAULT_JWKS_TTL_SECONDS = 300;

export interface JwksCacheEntry {
  keys: JsonWebKeySet;
  expiresAt: number;
}

/** Кеш ключей: JWKS меняется редко (ротация раз в месяцы), а проверять подпись
 * каждого токена по сети было бы лишним внутренним вызовом. */
export interface JwksCache {
  get(): JwksCacheEntry | undefined;
  set(entry: JwksCacheEntry): void;
  clear(): void;
}

export function createJwksCache(): JwksCache {
  let entry: JwksCacheEntry | undefined;

  return {
    get: () => entry,
    set: (next) => {
      entry = next;
    },
    clear: () => {
      entry = undefined;
    },
  };
}
