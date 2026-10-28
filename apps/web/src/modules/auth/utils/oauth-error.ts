/**
 * Provider errors that come back to the app as `?error=<code>`.
 *
 * The codes are Better Auth's OAuth callback codes (`state_mismatch`,
 * `access_denied`, `invalid_code`, ...). The UI distinguishes only three cases,
 * because the rest mean the same thing to a user — the attempt failed and the
 * only useful action is to try again.
 */
export type OAuthErrorKey = 'oauthDenied' | 'oauthExpired' | 'oauthFailed';

const ERROR_KEYS: Record<string, OAuthErrorKey> = {
  /** The user closed the consent screen or revoked access. */
  access_denied: 'oauthDenied',
  /** The state cookie is gone: the attempt is stale (closed tab, expired flow). */
  state_mismatch: 'oauthExpired',
  state_not_found: 'oauthExpired',
  please_restart_the_process: 'oauthExpired',
  invalid_callback_request: 'oauthExpired',
};

/** Translation key of `auth.errors` for a provider error code. */
export function oauthErrorKey(code: string | null | undefined): OAuthErrorKey {
  if (!code) {
    return 'oauthFailed';
  }

  return ERROR_KEYS[code] ?? 'oauthFailed';
}
