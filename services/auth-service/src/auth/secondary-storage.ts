import type { SecondaryStorage } from 'better-auth';

const PREFIX = 'auth';

/** Cloudflare KV отклоняет expiration_ttl меньше 60 секунд. */
const MIN_TTL_SECONDS = 60;

/** Срок жизни для ключей без явного TTL: достаточно для cookie-кэша и счётчиков. */
const DEFAULT_TTL_SECONDS = 60 * 60;

function storageKey(key: string): string {
  return `${PREFIX}:${key}`;
}

/**
 * KV требует целый TTL не меньше минуты: короткие значения из cookie-кэша
 * продлеваются до минимальных. Для сессии это безопасно — сама cookie
 * истекает раньше, и сервер всё равно сверяется с D1.
 */
function kvTtl(value: number | undefined): number {
  return Math.max(MIN_TTL_SECONDS, Math.ceil(value ?? DEFAULT_TTL_SECONDS));
}

/**
 * Вторичное хранилище Better Auth на KV: rate limit и cookie-кэш.
 *
 * Важное ограничение: в KV нет атомарного инкремента, поэтому `increment`
 * делает чтение и запись по отдельности. Для счётчиков авторизации это
 * означает, что несколько параллельных запросов одного клиента могут
 * проскочить счётчик на единицу — тот же компромисс, что и в rate limit
 * gateway. Если понадобится строгий лимит, переходим на Durable Object.
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
