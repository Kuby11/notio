import { z } from 'zod';

/** Path the gateway uses to fetch the auth-service JWKS through a Service Binding. */
export const AUTH_JWKS_PATH = '/api/auth/jwks';

export const JsonWebKeySetSchema = z.object({
  keys: z.array(
    z.object({
      kid: z.string().optional(),
      kty: z.string(),
      alg: z.string().optional(),
      use: z.string().optional(),
      n: z.string().optional(),
      e: z.string().optional(),
      x: z.string().optional(),
      y: z.string().optional(),
      crv: z.string().optional(),
    }),
  ),
});

export type JsonWebKeySet = z.infer<typeof JsonWebKeySetSchema>;

/**
 * Claims of an issued JWT.
 *
 * Verified at the boundary: the gateway does not trust the token payload
 * until the signature has been checked against the JWKS key.
 */
export const AuthClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email().optional(),
  name: z.string().optional(),
  /** Better Auth session id — access can be revoked through it. */
  sessionId: z.string().optional(),
  exp: z.number(),
  iat: z.number().optional(),
});

export type AuthClaims = z.infer<typeof AuthClaimsSchema>;

/** User resolved by the gateway from the signed token. */
export interface AuthenticatedUser {
  id: string;
  claims: AuthClaims;
}
