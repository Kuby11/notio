import type { AuthGateway } from './ports';

/**
 * Выдаёт JWT активной сессии для вызовов закрытого API.
 *
 * Токен используется в заголовке Authorization конкретного запроса и не
 * кладётся в localStorage, Zustand или URL.
 */
export class AccessToken {
  constructor(private readonly auth: AuthGateway) {}

  execute(): Promise<string | null> {
    return this.auth.accessToken();
  }
}
