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
  /**
   * Shared parent domain of web+gateway for the session cookie. Only for a real
   * registrable domain (example.com): a public suffix such as
   * `<account>.workers.dev` makes browsers reject the cookie.
   */
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
  /**
   * EmailJS for real email delivery (email confirmation, password reset):
   * service id, template id, public and private keys (the private key is
   * required for server-side calls). Until they are set, emails are
   * "sent" to the worker log — the link is visible in the console.
   */
  EMAILJS_SERVICE_ID?: string;
  EMAILJS_TEMPLATE_ID?: string;
  EMAILJS_PUBLIC_KEY?: string;
  EMAILJS_PRIVATE_KEY?: string;
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
      'BETTER_AUTH_SECRET is not set. Locally: add it to .dev.vars; in production: wrangler secret put BETTER_AUTH_SECRET',
    );
  }

  return secret;
}
