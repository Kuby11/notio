import { createAccessToken, type AccessTokenProvider } from './api/access-token';
import { createBetterAuthGateway } from './api/auth.api';
import type { AuthGateway } from './types/ports';

export { LoginForm } from './ui/public/login-form';
export { RegisterForm } from './ui/public/register-form';
export { useAuth } from './hooks/use-auth';
export { authErrorCode } from './utils/error-mapper';
export { AuthError, isAuthError } from './types/errors';
export type { AuthErrorCode } from './types/errors';
export type { AuthGateway, AuthSession, SessionUser } from './types/ports';
export type { Credentials, SignUpInput } from './utils/credentials';
export { MIN_PASSWORD_LENGTH, normalizeEmail, validateCredentials } from './utils/credentials';

/**
 * Public API of the authentication module.
 *
 * Only the factory, the facade hooks and the UI components face outward. The
 * Better Auth adapter, the JWT cache and the DTOs stay internal: the container
 * gets ports from the module and nothing else.
 */

export interface AuthModule {
  /** Authentication port: facade hooks depend only on this interface. */
  gateway: AuthGateway;
  /** The active session's JWT with a cache: the container passes it to other modules. */
  accessToken: AccessTokenProvider;
}

/** Builds the authentication module over Better Auth (production and e2e). */
export function createAuthModule(options: { baseUrl: string }): AuthModule {
  return createAuthModuleWithGateway(createBetterAuthGateway(options));
}

/** Builds the authentication module over a ready-made gateway (tests, storybook). */
export function createAuthModuleWithGateway(gateway: AuthGateway): AuthModule {
  return { gateway, accessToken: createAccessToken(gateway) };
}
