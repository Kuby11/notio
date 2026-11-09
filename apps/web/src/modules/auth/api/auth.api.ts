import { createAuthClient } from 'better-auth/client';
import { jwtClient } from 'better-auth/client/plugins';
import type { AuthGateway, AuthSession, SessionUser, SignUpInput } from '../types/ports';
import type { Credentials } from '../utils/credentials';
import type { AuthError } from '../types/errors';
import {
  AuthErrorResponseSchema,
  SessionResponseSchema,
  SignUpResponseSchema,
  TokenResponseSchema,
} from '../types/dto';
import { isAuthError } from '../types/errors';
import { authErrorFromPayload, authErrorFromStatus, networkError } from '../utils/error-mapper';

/**
 * Authentication adapter over the Better Auth client.
 *
 * Only the AuthGateway port faces outward: facade hooks and components know
 * neither Better Auth nor its error codes. Responses are validated by Zod —
 * the network is not a trusted source.
 */

/** Error the Better Auth client returns instead of throwing. */
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

/** Runs a client call and turns any outcome into data or an AuthError. */
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
  /** Gateway address: the client only talks to it, never directly to services. */
  baseUrl: string;
}

export function createBetterAuthGateway(options: AuthGatewayOptions): AuthGateway {
  const client = createAuthClient({
    // An empty base URL keeps the client on the app origin: the route handler
    // at app/api/auth proxies the call to the gateway, so the session cookie is
    // issued for the app host (web and gateway cannot share one: workers.dev is
    // a public suffix).
    baseURL: options.baseUrl || undefined,
    basePath: '/api/auth',
    plugins: [jwtClient()],
    // The session lives in a cookie: without credentials it would never reach the gateway.
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
      const origin = window.location.origin;
      const absolute = (path: string) => `${origin}${path.startsWith('/') ? path : `/${path}`}`;

      try {
        const result = await client.signIn.social({
          provider,
          // Absolute frontend address: otherwise Better Auth resolves
          // callbackURL relative to its own baseURL (the gateway) and after
          // sign-in the user lands on the gateway root instead of the app.
          callbackURL: absolute(callbackUrl),
          // A denied consent, an expired state or a provider error must come
          // back to the page the user started from (with ?error=<code>): the
          // gateway's own error page has no UI to return to the app.
          errorCallbackURL: `${origin}${window.location.pathname}`,
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

    async updateUser(input: { name?: string; image?: string | null }): Promise<SessionUser> {
      // update-user answers with `{ status: true }`, not with the user: read the
      // persisted state back so the UI shows what the server actually stored.
      await call(() => client.updateUser(input));

      const session = await readSession();

      if (session === null) {
        throw authErrorFromStatus(401);
      }

      return session.user;
    },

    async changeEmail(newEmail: string): Promise<void> {
      await call(() => client.changeEmail({ newEmail, callbackURL: '/' }));
    },

    async changePassword(input: { newPassword: string }): Promise<void> {
      // Plain fetch to the auth-service's own endpoint: the standard Better Auth
      // changePassword demands the current password, while the form relies on the
      // fresh-session check instead (Notion-style). The response is validated
      // by Zod — the network is not a trusted source.
      let response: Response;

      try {
        response = await fetch(`${options.baseUrl}/api/auth/change-password/session`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ newPassword: input.newPassword }),
        });
      } catch (error) {
        throw networkError(error);
      }

      if (response.ok) {
        return;
      }

      const payload = AuthErrorResponseSchema.safeParse(await response.json().catch(() => null));

      throw payload.success
        ? authErrorFromPayload({
            code: payload.data.code,
            status: payload.data.status ?? response.status,
          })
        : authErrorFromStatus(response.status);
    },

    async deleteAccount(): Promise<void> {
      await call(() => client.deleteUser({}));
    },

    currentSession: readSession,

    async accessToken(): Promise<string | null> {
      // The request goes through plain fetch: the JWT is issued by a Better Auth plugin, there is no
      // dedicated client method for it, and the response is validated by Zod anyway.
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
        // A network failure equals no session: the token simply never arrives.
        return null;
      }
    },
  };

  /** Reads the active session; an empty body is a valid "nobody is signed in". */
  async function readSession(): Promise<AuthSession | null> {
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
  }
}
