import { Hono } from 'hono';
import { INTERNAL_HEADERS, problem } from '@notio/contracts';
import { createAuth } from '../auth/config';
import { AUTH_BASE_PATH, type AuthDependencies } from '../auth/options';
import { createUserRepository } from '../db/user.repository';
import type { AppEnv } from '../env';
import { SERVICE_NAME } from './health';

const SIGN_UP_PATH = `${AUTH_BASE_PATH}/sign-up/email`;
const OAUTH_CALLBACK_PREFIX = `${AUTH_BASE_PATH}/callback/`;

/**
 * Better Auth handler: registration, sign-in, sign-out, session, verification,
 * password reset and JWKS. Better Auth logic is not rewritten — it is routed.
 *
 * `dependencies` is the substitution point for tests (intercepting emails).
 */
export function createAuthRoutes(dependencies?: Partial<AuthDependencies>): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  /**
   * Registration with an honest answer about a taken email.
   *
   * Better Auth 1.7 answers 200 and returns a user that is not in the database:
   * the insert violated a unique index and the error never reached the client.
   * The client would see "success" and lose the account, so availability is
   * checked upfront and 409 is returned in the project's shared error format.
   */
  routes.post(SIGN_UP_PATH, async (c) => {
    const email = await readEmail(c.req.raw);

    if (email !== null) {
      const existing = await createUserRepository(c.env).findByEmail(email);

      if (existing !== null) {
        return problem({
          status: 409,
          code: 'CONFLICT',
          detail: 'An account with this email already exists',
          requestId: c.req.header(INTERNAL_HEADERS.REQUEST_ID),
        });
      }
    }

    return createAuth(c.env, dependencies).handler(c.req.raw);
  });

  /**
   * OAuth callback failures are logged with the provider's own reason.
   *
   * The user only sees a redirect back to the app, so without this line a
   * broken provider setup (`state_mismatch`, `access_denied`, `invalid_code`)
   * leaves no trace in the dev console and looks like "the button does nothing".
   */
  routes.all(`${OAUTH_CALLBACK_PREFIX}*`, async (c) => {
    const response = await createAuth(c.env, dependencies).handler(c.req.raw);
    const reason = callbackError(response.headers.get('location'));

    if (reason !== null) {
      console.warn(
        JSON.stringify({
          level: 'warn',
          service: SERVICE_NAME,
          event: 'oauth_callback_error',
          provider: c.req.path.slice(OAUTH_CALLBACK_PREFIX.length),
          error: reason,
        }),
      );
    }

    return response;
  });

  routes.all(`${AUTH_BASE_PATH}/*`, (c) => createAuth(c.env, dependencies).handler(c.req.raw));

  routes.all(AUTH_BASE_PATH, (c) => createAuth(c.env, dependencies).handler(c.req.raw));

  return routes;
}

/** Email from the request body; with an unreadable body the check is skipped. */
async function readEmail(request: Request): Promise<string | null> {
  try {
    const body = (await request.clone().json()) as { email?: unknown };

    return typeof body.email === 'string' ? body.email : null;
  } catch {
    return null;
  }
}

/** `error` query parameter of the redirect Better Auth sends after a failed callback. */
function callbackError(location: string | null): string | null {
  if (location === null) {
    return null;
  }

  try {
    return new URL(location, 'http://localhost').searchParams.get('error');
  } catch {
    // An unparsable Location is not worth an exception: the response still goes through.
    return null;
  }
}
