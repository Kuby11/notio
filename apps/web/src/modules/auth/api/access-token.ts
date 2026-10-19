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

  return {
    async execute(): Promise<string | null> {
      const currentTime = now();

      if (cached !== null && cached.expiresAt > currentTime) {
        return cached.token;
      }

      const token = await auth.accessToken();

      if (token !== null) {
        // Кешируем на TTL: токен живёт дольше, но обновление раз в минуту
        // достаточно, чтобы не бить по auth-service на каждый запрос.
        cached = { token, expiresAt: currentTime + ACCESS_TOKEN_TTL_MS };
      } else {
        cached = null;
      }

      return token;
    },

    clear(): void {
      cached = null;
    },
  };
}
