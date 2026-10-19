import type { AuthGateway, AuthSession } from '../../types/ports';

/** Текущая сессия пользователя: null означает «не выполнен вход». */
export class CurrentSession {
  constructor(private readonly auth: AuthGateway) {}

  execute(): Promise<AuthSession | null> {
    return this.auth.currentSession();
  }
}
