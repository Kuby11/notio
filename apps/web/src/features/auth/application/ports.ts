import type { Credentials } from '../domain';

/**
 * Порт аутентификации.
 *
 * Реализация — адаптер поверх Better Auth за gateway; use cases знают только
 * этот интерфейс, поэтому в тестах подставляется in-memory версия без сети.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

export interface AuthSession {
  user: SessionUser;
  expiresAt: string;
}

export interface SignUpInput extends Credentials {
  name: string;
}

export interface AuthGateway {
  /** Регистрация. Сессия не создаётся: сначала подтверждение почты. */
  signUp(input: SignUpInput): Promise<void>;
  /** Вход по паролю. Бросает AuthError с кодом EMAIL_NOT_VERIFIED, если почта не подтверждена. */
  signIn(credentials: Credentials): Promise<void>;
  /** Выход: сервер отзывает сессию, клиент теряет cookie. */
  signOut(): Promise<void>;
  /** Текущая сессия или null, если пользователь не входит. */
  currentSession(): Promise<AuthSession | null>;
  /**
   * Короткоживущий JWT для вызовов закрытого API.
   * Токен живёт только в памяти вызова и не сохраняется в хранилище браузера.
   */
  accessToken(): Promise<string | null>;
}
