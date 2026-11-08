import { describe, expect, it } from 'vitest';
import { oauthErrorKey } from './oauth-error';

describe('oauthErrorKey', () => {
  it('tells a user rejection apart from an expired attempt', () => {
    expect(oauthErrorKey('access_denied')).toBe('oauthDenied');
    expect(oauthErrorKey('state_mismatch')).toBe('oauthExpired');
  });

  it('collapses unknown provider codes to the generic message', () => {
    expect(oauthErrorKey('invalid_code')).toBe('oauthFailed');
    expect(oauthErrorKey('unable_to_get_user_info')).toBe('oauthFailed');
  });

  it('returns the generic message without a code', () => {
    expect(oauthErrorKey(null)).toBe('oauthFailed');
    expect(oauthErrorKey(undefined)).toBe('oauthFailed');
    expect(oauthErrorKey('')).toBe('oauthFailed');
  });
});
