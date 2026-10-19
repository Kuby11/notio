import { createAccessToken, type AccessTokenProvider } from './api/access-token';
import { createBetterAuthGateway } from './api/auth.api';
import type { AuthGateway } from './types/ports';

export { LoginForm } from './ui/public/login-form';
export { RegisterForm } from './ui/public/register-form';
export { SessionPanel } from './ui/public/session-panel';
export {
  authErrorMessage,
  useSession,
  useSignIn,
  useSignInWithProvider,
  useSignOut,
  useSignUp,
} from './hooks/use-auth';
export { AuthError, isAuthError } from './types/errors';
export type { AuthErrorCode } from './types/errors';
export type { AuthGateway, AuthSession, SessionUser } from './types/ports';
export type { Credentials, SignUpInput } from './utils/credentials';
export { MIN_PASSWORD_LENGTH, normalizeEmail, validateCredentials } from './utils/credentials';

/**
 * Публичный API модуля аутентификации.
 *
 * Наружу выходят только фабрика, facade-хуки и UI-компоненты. Адаптер
 * Better Auth, кеш JWT и DTO остаются внутренними деталями: контейнер
 * получает из модуля лишь порты.
 */

export interface AuthModule {
  /** Порт аутентификации: facade-хуки зависят только от этого интерфейса. */
  gateway: AuthGateway;
  /** JWT активной сессии с кешем: контейнер передаёт его другим модулям. */
  accessToken: AccessTokenProvider;
}

/** Собирает модуль аутентификации поверх Better Auth (продакшен и e2e). */
export function createAuthModule(options: { baseUrl: string }): AuthModule {
  return createAuthModuleWithGateway(createBetterAuthGateway(options));
}

/** Собирает модуль аутентификации поверх готового gateway (тесты, storybook). */
export function createAuthModuleWithGateway(gateway: AuthGateway): AuthModule {
  return { gateway, accessToken: createAccessToken(gateway) };
}
