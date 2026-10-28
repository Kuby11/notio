import type { JsonWebKeySet } from '@notio/contracts';

export const DEFAULT_JWKS_TTL_SECONDS = 300;

export interface JwksCacheEntry {
  keys: JsonWebKeySet;
  expiresAt: number;
}

/** Key cache: JWKS changes rarely (rotation every few months), and verifying
 * every token signature over the network would be an extra internal call. */
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
