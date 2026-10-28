import { describe, expect, it } from 'vitest';
import { oauthErrorKey } from './oauth-error';

describe('oauthErrorKey', () => {
  it('отличает отказ пользователя от истёкшей попытки', () => {
    expect(oauthErrorKey('access_denied')).toBe('oauthDenied');
    expect(oauthErrorKey('state_mismatch')).toBe('oauthExpired');
  });

  it('сводит незнакомые коды провайдера к общему сообщению', () => {
    expect(oauthErrorKey('invalid_code')).toBe('oauthFailed');
    expect(oauthErrorKey('unable_to_get_user_info')).toBe('oauthFailed');
  });

  it('без кода возвращает общее сообщение', () => {
    expect(oauthErrorKey(null)).toBe('oauthFailed');
    expect(oauthErrorKey(undefined)).toBe('oauthFailed');
    expect(oauthErrorKey('')).toBe('oauthFailed');
  });
});
