import { describe, expect, it } from 'vitest';
import { AuthClaimsSchema, AUTH_JWKS_PATH, JsonWebKeySetSchema } from './auth';

describe('JWKS', () => {
  it('принимает набор ключей, который отдаёт auth-service', () => {
    const jwks = {
      keys: [{ kty: 'RSA', kid: 'key-1', alg: 'RS256', use: 'sig', n: 'modulus', e: 'AQAB' }],
    };

    expect(JsonWebKeySetSchema.parse(jwks)).toEqual(jwks);
  });

  it('требует хотя бы одно поле ключа', () => {
    expect(JsonWebKeySetSchema.safeParse({ keys: [{}] }).success).toBe(false);
  });

  it('не принимает набор без ключей', () => {
    expect(JsonWebKeySetSchema.safeParse({}).success).toBe(false);
  });

  it('путь JWKS задан один раз и совпадает с публичным префиксом', () => {
    expect(AUTH_JWKS_PATH).toBe('/api/auth/jwks');
  });
});

describe('AuthClaimsSchema', () => {
  const claims = { sub: 'user-1', email: 'user@notio.dev', sessionId: 's-1', exp: 1_700_000_000 };

  it('принимает claims подписанного токена', () => {
    expect(AuthClaimsSchema.parse(claims)).toEqual(claims);
  });

  it('требует субъект и срок действия', () => {
    expect(AuthClaimsSchema.safeParse({ email: 'user@notio.dev' }).success).toBe(false);
    expect(AuthClaimsSchema.safeParse({ sub: 'user-1' }).success).toBe(false);
  });

  it('не принимает пустого пользователя', () => {
    expect(AuthClaimsSchema.safeParse({ ...claims, sub: '' }).success).toBe(false);
  });

  it('проверяет формат почты, если она передана', () => {
    expect(AuthClaimsSchema.safeParse({ ...claims, email: 'не-почта' }).success).toBe(false);
  });
});
