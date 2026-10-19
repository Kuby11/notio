import type { Credentials, SignUpInput } from '../utils/credentials';

/**
 * Порт аутентификации.
 *
 * Реализация — адаптер поверх Better Auth; facade-хуки знают только этот
 * интерфейс, поэтому в тестах подставляется in-memory версия без сети.
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

export interface AuthGateway {
  /** Регистрация. Сессия не создаётся: сначала подтверждение почты. */
  signUp(input: SignUpInput): Promise<void>;
  /** Вход по паролю. Бросает AuthError с кодом EMAIL_NOT_VERIFIED, если почта не подтверждена. */
  signIn(credentials: Credentials): Promise<void>;
  /**
   * Вход через внешнего провайдера (Google, GitHub).
   *
   * Браузер перенаправляется на страницу провайдера; после возврата
   * сессия устанавливается автоматически и пользователь оказывается на
   * callbackURL. Токен в клиенте не хранится.
   */
  signInWithProvider(provider: 'google' | 'github', callbackUrl?: string): Promise<void>;
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

export type { Credentials, SignUpInput };
