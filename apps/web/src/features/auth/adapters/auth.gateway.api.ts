import { createAuthClient } from 'better-auth/client';
import { jwtClient } from 'better-auth/client/plugins';
import type { AuthGateway, AuthSession, SignUpInput } from '../application/ports';
import type { AuthError, Credentials } from '../domain';
import { isAuthError } from '../domain';
import {
  AuthErrorResponseSchema,
  SessionResponseSchema,
  SignUpResponseSchema,
  TokenResponseSchema,
} from './auth.dto';
import { authErrorFromPayload, authErrorFromStatus, networkError } from './auth.error-mapper';

/**
 * Адаптер аутентификации поверх клиента Better Auth.
 *
 * Наружу смотрит только порт AuthGateway: use cases и компоненты не знают
 * ни про Better Auth, ни про коды его ошибок. Ответы валидируются Zod —
 * сеть не доверенный источник.
 */

/** Ошибка, которую клиент Better Auth возвращает вместо исключения. */
interface ClientError {
  message?: string | undefined;
  status?: number | undefined;
  code?: string | undefined;
}

function toAuthError(error: ClientError | null): AuthError {
  if (!error) {
    return authErrorFromStatus(500);
  }

  const payload = AuthErrorResponseSchema.safeParse(error);

  return payload.success
    ? authErrorFromPayload(payload.data)
    : authErrorFromStatus(error.status ?? 500);
}

/** Выполняет вызов клиента и превращает любой исход в данные или AuthError. */
async function call<T>(
  run: () => Promise<{ data: T | null; error: ClientError | null }>,
): Promise<T> {
  let result: { data: T | null; error: ClientError | null };

  try {
    result = await run();
  } catch (error) {
    throw networkError(error);
  }

  if (result.error !== null || result.data === null) {
    throw toAuthError(result.error);
  }

  return result.data;
}

export interface AuthGatewayOptions {
  /** Адрес gateway: клиент ходит только туда, напрямую к сервисам не ходит. */
  baseUrl: string;
}

export function createBetterAuthGateway(options: AuthGatewayOptions): AuthGateway {
  const client = createAuthClient({
    baseURL: options.baseUrl,
    basePath: '/api/auth',
    plugins: [jwtClient()],
    // Сессия живёт в cookie: без credentials он не долетит до gateway.
    fetchOptions: { credentials: 'include' },
  });

  return {
    async signUp(input: SignUpInput): Promise<void> {
      const data = await call(() =>
        client.signUp.email({ email: input.email, password: input.password, name: input.name }),
      );

      SignUpResponseSchema.parse(data);
    },

    async signIn(credentials: Credentials): Promise<void> {
      await call(() => client.signIn.email(credentials));
    },

    async signInWithProvider(provider: 'google' | 'github', callbackUrl = '/'): Promise<void> {
      try {
        const result = await client.signIn.social({
          provider,
          callbackURL: callbackUrl,
        });

        if (result.error !== null) {
          throw toAuthError(result.error);
        }
      } catch (error) {
        if (isAuthError(error)) {
          throw error;
        }

        throw networkError(error);
      }
    },

    async signOut(): Promise<void> {
      await call(() => client.signOut());
    },

    async currentSession(): Promise<AuthSession | null> {
      let result: { data: unknown; error: ClientError | null };

      try {
        result = await client.getSession();
      } catch (error) {
        throw networkError(error);
      }

      if (result.error !== null) {
        throw toAuthError(result.error);
      }

      const parsed = SessionResponseSchema.safeParse(result.data);

      if (!parsed.success || parsed.data === null) {
        return null;
      }

      return {
        user: parsed.data.user,
        expiresAt: new Date(parsed.data.session.expiresAt).toISOString(),
      };
    },

    async accessToken(): Promise<string | null> {
      // Запрос идёт обычным fetch: JWT выдаёт плагин Better Auth, отдельного
      // клиентского метода у него нет, а ответ всё равно проверяется Zod.
      try {
        const response = await fetch(`${options.baseUrl}/api/auth/token`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          return null;
        }

        const parsed = TokenResponseSchema.safeParse(await response.json());

        return parsed.success ? parsed.data.token : null;
      } catch {
        // Обрыв сети равносилен отсутствию сессии: токен просто не выдадут.
        return null;
      }
    },
  };
}
