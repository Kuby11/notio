/**
 * Публичный API фичи аутентификации.
 *
 * Другие части приложения импортируют только `features/auth` — внутренности
 * фичи (порты, адаптеры, домен) наружу не выдаются.
 */
export { AccessToken } from './application/access-token';
export { CurrentSession } from './application/current-session';
export { SignIn } from './application/sign-in';
export { SignOut } from './application/sign-out';
export { SignUp } from './application/sign-up';
export type { AuthGateway, AuthSession, SessionUser, SignUpInput } from './application/ports';
export { createBetterAuthGateway } from './adapters/auth.gateway.api';
export { AuthError, isAuthError } from './domain/errors';
export type { AuthErrorCode } from './domain/errors';
export { MIN_PASSWORD_LENGTH, normalizeEmail, validateCredentials } from './domain/credentials';
export {
  LoginForm,
  RegisterForm,
  authErrorMessage,
  useSession,
  useSignIn,
  useSignOut,
  useSignUp,
} from './ui';
