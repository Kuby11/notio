/** What Better Auth expects back: whether the request fits and when to retry. */
export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number | null;
}

interface RateLimitRecord {
  count: number;
  lastRequest: number;
}

/** Cloudflare KV rejects expiration_ttl below 60 seconds. */
const MIN_TTL_SECONDS = 60;

/** Kept apart from the gateway's `rl:` keys, which share the namespace. */
const KEY_PREFIX = 'auth:rl:';

function recordKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

function parseRecord(raw: string | null): RateLimitRecord | null {
  if (raw === null) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<RateLimitRecord> | null;

    if (typeof parsed?.count !== 'number' || typeof parsed.lastRequest !== 'number') {
      return null;
    }

    return { count: parsed.count, lastRequest: parsed.lastRequest };
  } catch {
    return null;
  }
}

/**
 * Better Auth rate limits on KV.
 *
 * Deliberately `rateLimit.customStorage` and not `secondaryStorage`: secondary
 * storage also becomes session storage, and sessions must live in D1 only.
 *
 * KV has no atomic increment — unlike the D1 and memory storages Better Auth
 * ships, `consume` here is a read-modify-write, so a concurrent burst can slip
 * the counter by roughly one. That is the same compromise as the gateway
 * limiter; a strict limit needs a Durable Object.
 */
export function createKvRateLimitStorage(namespace: KVNamespace) {
  return {
    consume: async (
      key: string,
      rule: { window: number; max: number },
    ): Promise<RateLimitDecision> => {
      const now = Date.now();
      const windowMs = rule.window * 1000;
      const stored = recordKey(key);
      const record = parseRecord(await namespace.get(stored));
      const write = (count: number): Promise<void> =>
        namespace.put(stored, JSON.stringify({ count, lastRequest: now }), {
          expirationTtl: Math.max(MIN_TTL_SECONDS, Math.ceil(rule.window)),
        });

      // No record, or the previous window has elapsed: this request opens a new one.
      if (record === null || now - record.lastRequest >= windowMs) {
        await write(1);

        return { allowed: true, retryAfter: null };
      }

      if (record.count >= rule.max) {
        return {
          allowed: false,
          retryAfter: Math.max(1, Math.ceil((record.lastRequest + windowMs - now) / 1000)),
        };
      }

      await write(record.count + 1);

      return { allowed: true, retryAfter: null };
    },
  };
}

export type RateLimitStorage = ReturnType<typeof createKvRateLimitStorage>;
