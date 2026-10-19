import type { AuthGateway } from '../../types/ports';

/**
 * Выход из аккаунта.
 *
 * Ошибка сети не превращается в «успешный» выход: иначе интерфейс покажет,
 * что пользователь вышел, хотя cookie осталась и сессия ещё активна.
 */
export class SignOut {
  constructor(private readonly auth: AuthGateway) {}

  execute(): Promise<void> {
    return this.auth.signOut();
  }
}
