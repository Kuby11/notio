import type { SecondaryStorage } from 'better-auth';

const PREFIX = 'auth';

/** Cloudflare KV rejects expiration_ttl below 60 seconds. */
const MIN_TTL_SECONDS = 60;

/** Lifetime for keys without an explicit TTL: enough for the cookie cache and counters. */
const DEFAULT_TTL_SECONDS = 60 * 60;

function storageKey(key: string): string {
  return `${PREFIX}:${key}`;
}

/**
 * KV requires an integer TTL of at least a minute: short values from the
 * cookie cache are rounded up to the minimum. This is safe for sessions —
 * the cookie itself expires earlier, and the server checks D1 anyway.
 */
function kvTtl(value: number | undefined): number {
  return Math.max(MIN_TTL_SECONDS, Math.ceil(value ?? DEFAULT_TTL_SECONDS));
}

/**
 * Better Auth secondary storage on KV: rate limits and the cookie cache.
 *
 * Important limitation: KV has no atomic increment, so `increment` does a
 * separate read and write. For auth counters this means several parallel
 * requests from one client can slip the counter by one — the same
 * compromise as the gateway rate limit. Move to a Durable Object when a
 * strict limit is needed.
 */
export function createKvSecondaryStorage(namespace: KVNamespace): SecondaryStorage {
  return {
    get: (key) => namespace.get(storageKey(key)),

    getAndDelete: async (key) => {
      const value = await namespace.get(storageKey(key));
      await namespace.delete(storageKey(key));

      return value;
    },

    increment: async (key, windowTtl) => {
      const stored = await namespace.get(storageKey(key));
      const current = Number.parseInt(stored ?? '0', 10);
      const next = (Number.isFinite(current) ? current : 0) + 1;

      await namespace.put(storageKey(key), String(next), {
        expirationTtl: kvTtl(windowTtl),
      });

      return next;
    },

    set: async (key, value, valueTtl) => {
      await namespace.put(storageKey(key), value, { expirationTtl: kvTtl(valueTtl) });
    },

    delete: async (key) => {
      await namespace.delete(storageKey(key));
    },
  };
}
