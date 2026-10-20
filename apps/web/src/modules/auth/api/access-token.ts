import type { TokenProvider } from '../../../shared/types';
import type { AuthGateway } from '../types/ports';

/**
 * Инфраструктура api: JWT активной сессии с кешем в памяти.
 *
 * Провайдер живёт вне React: контейнер передаёт его репозиториям других
 * модулей как `TokenProvider`. Токен не сохраняется в хранилище браузера.
 * Кеш нужен, чтобы каждый запрос к страницам не создавал отдельный запрос
 * к auth-service и не исчерпывал его rate limit.
 */
export interface AccessTokenProvider extends TokenProvider {
  /** Сбрасывает кеш: вызывается при выходе из аккаунта. */
  clear(): void;
}

/** Сколько живёт кеш токена в памяти. */
export const ACCESS_TOKEN_TTL_MS = 60_000;

/**
 * `now` инжектируется для тестов: поведение кеша детерминировано без таймеров.
 */
export function createAccessToken(
  auth: AuthGateway,
  now: () => number = () => Date.now(),
): AccessTokenProvider {
  let cached: { token: string; expiresAt: number } | null = null;
  let inFlight: Promise<string | null> | null = null;
  // Поколение защищает от гонки: ответ, начатый до clear(), не должен
  // вернуть старый токен обратно в кеш после выхода из аккаунта.
  let generation = 0;

  return {
    async execute(): Promise<string | null> {
      const currentTime = now();

      if (cached !== null && cached.expiresAt > currentTime) {
        return cached.token;
      }

      // Параллельные запросы страниц не должны устраивать stampede
      // в /api/auth/token: все ждут один и тот же in-flight запрос.
      if (inFlight !== null) {
        return inFlight;
      }

      const requestGeneration = generation;
      const request = (async () => {
        const token = await auth.accessToken();

        if (requestGeneration === generation) {
          if (token !== null) {
            // Кешируем на TTL: токен живёт дольше, но обновление раз в минуту
            // достаточно, чтобы не бить по auth-service на каждый запрос.
            cached = { token, expiresAt: now() + ACCESS_TOKEN_TTL_MS };
          } else {
            cached = null;
          }
        }

        return token;
      })();

      inFlight = request;

      try {
        return await request;
      } finally {
        if (inFlight === request) {
          inFlight = null;
        }
      }
    },

    clear(): void {
      generation += 1;
      cached = null;
      inFlight = null;
    },
  };
}
