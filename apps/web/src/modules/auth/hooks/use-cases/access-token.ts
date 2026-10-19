import type { AuthGateway } from '../../types/ports';

/**
 * Выдаёт JWT активной сессии для вызовов закрытого API.
 *
 * Токен живёт только в памяти вызова и не сохраняется в хранилище браузера.
 * Повторные вызовы в рамках короткого окна возвращают кешированный токен:
 * иначе каждое обращение к страницам создавало бы отдельный запрос к
 * auth-service и быстро исчерпывало бы его rate limit.
 */
export class AccessToken {
  private cached: { token: string; expiresAt: number } | null = null;

  constructor(private readonly auth: AuthGateway) {}

  async execute(): Promise<string | null> {
    const now = Date.now();

    if (this.cached !== null && this.cached.expiresAt > now) {
      return this.cached.token;
    }

    const token = await this.auth.accessToken();

    if (token !== null) {
      // Кешируем на 60 секунд: токен живёт дольше, но обновление раз в минуту
      // достаточно, чтобы не бить по auth-service на каждый запрос к страницам.
      this.cached = { token, expiresAt: now + 60_000 };
    } else {
      this.cached = null;
    }

    return token;
  }

  /** Сбрасывает кеш: вызывается при выходе из аккаунта. */
  clear(): void {
    this.cached = null;
  }
}
