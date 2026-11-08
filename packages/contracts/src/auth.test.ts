import { describe, expect, it } from 'vitest';
import { AuthClaimsSchema, AUTH_JWKS_PATH, JsonWebKeySetSchema } from './auth';

describe('JWKS', () => {
  it('accepts the key set served by the auth service', () => {
    const jwks = {
      keys: [{ kty: 'RSA', kid: 'key-1', alg: 'RS256', use: 'sig', n: 'modulus', e: 'AQAB' }],
    };

    expect(JsonWebKeySetSchema.parse(jwks)).toEqual(jwks);
  });

  it('requires at least one key field', () => {
    expect(JsonWebKeySetSchema.safeParse({ keys: [{}] }).success).toBe(false);
  });

  it('rejects a set without keys', () => {
    expect(JsonWebKeySetSchema.safeParse({}).success).toBe(false);
  });

  it('JWKS path is defined once and matches the public prefix', () => {
    expect(AUTH_JWKS_PATH).toBe('/api/auth/jwks');
  });
});

describe('AuthClaimsSchema', () => {
  const claims = { sub: 'user-1', email: 'user@notio.dev', sessionId: 's-1', exp: 1_700_000_000 };

  it('accepts claims of a signed token', () => {
    expect(AuthClaimsSchema.parse(claims)).toEqual(claims);
  });

  it('requires a subject and an expiry', () => {
    expect(AuthClaimsSchema.safeParse({ email: 'user@notio.dev' }).success).toBe(false);
    expect(AuthClaimsSchema.safeParse({ sub: 'user-1' }).success).toBe(false);
  });

  it('rejects an empty subject', () => {
    expect(AuthClaimsSchema.safeParse({ ...claims, sub: '' }).success).toBe(false);
  });

  it('validates the email format when provided', () => {
    expect(AuthClaimsSchema.safeParse({ ...claims, email: 'not-an-email' }).success).toBe(false);
  });
});
