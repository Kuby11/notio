import { createBetterAuthGateway } from './api/auth.api';
import { AccessToken } from './hooks/use-cases/access-token';
import { CurrentSession } from './hooks/use-cases/current-session';
import { SignIn } from './hooks/use-cases/sign-in';
import { SignInWithProvider } from './hooks/use-cases/sign-in-with-provider';
import { SignOut } from './hooks/use-cases/sign-out';
import { SignUp } from './hooks/use-cases/sign-up';
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
export type { AuthGateway, AuthSession, SessionUser, SignUpInput } from './types/ports';
export type { Credentials } from './utils/credentials';
export { MIN_PASSWORD_LENGTH, normalizeEmail, validateCredentials } from './utils/credentials';

/**
 * Публичный API модуля аутентификации.
 *
 * Наружу выходят только фабрика модуля, facade-хуки и UI-компоненты.
 * Use cases, репозиторий-gateway и DTO остаются внутренними деталями:
 * `api` модуля нельзя импортировать за его пределами.
 */

export interface AuthModule {
  signIn: SignIn;
  signInWithProvider: SignInWithProvider;
  signUp: SignUp;
  signOut: SignOut;
  currentSession: CurrentSession;
  accessToken: AccessToken;
}

/** Собирает модуль аутентификации поверх Better Auth (продакшен и e2e). */
export function createAuthModule(options: { baseUrl: string }): AuthModule {
  return createAuthModuleWithGateway(createBetterAuthGateway(options));
}

/** Собирает модуль аутентификации поверх готового gateway (тесты, storybook). */
export function createAuthModuleWithGateway(gateway: AuthGateway): AuthModule {
  return {
    signIn: new SignIn(gateway),
    signInWithProvider: new SignInWithProvider(gateway),
    signUp: new SignUp(gateway),
    signOut: new SignOut(gateway),
    currentSession: new CurrentSession(gateway),
    accessToken: new AccessToken(gateway),
  };
}
