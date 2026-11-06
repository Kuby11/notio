/**
 * Environment contract of auth-service.
 *
 * Secrets (BETTER_AUTH_SECRET, OAuth client id/secret) arrive through
 * `wrangler secret` and are absent from wrangler.jsonc. A missing secret
 * breaks request serving rather than weakening protection.
 */
export interface Bindings {
  DB: D1Database;
  /** Secondary storage: rate limits and the cookie cache. */
  RATE_LIMIT: KVNamespace;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
  /** Public address of this service — Better Auth builds its links from it. */
  BETTER_AUTH_URL: string;
  /** Frontend address: after sign-in and email confirmation the user lands there, not on the gateway. */
  FRONTEND_URL?: string;
  /** Общий родительский домен web+gateway для cookie сессии (prod). */
  COOKIE_DOMAIN?: string;
  BETTER_AUTH_SECRET: string;
  RATE_LIMIT_MAX_REQUESTS?: string;
  RATE_LIMIT_WINDOW_SECONDS?: string;
  /**
   * Extra trusted origins, comma separated: the frontend address.
   * Without them a login from another port would be rejected as a foreign request.
   */
  TRUSTED_ORIGINS?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

export type AppEnv = {
  Bindings: Bindings;
  Variables: {
    requestId: string;
  };
};

/** The Better Auth secret is required in both dev and production. */
export function requireAuthSecret(env: Bindings): string {
  const secret = env.BETTER_AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      'BETTER_AUTH_SECRET не задан. Локально: добавьте его в .dev.vars, в production: wrangler secret put BETTER_AUTH_SECRET',
    );
  }

  return secret;
}
