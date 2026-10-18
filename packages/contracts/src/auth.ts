import { z } from 'zod';

/** Путь, по которому gateway получает JWKS у auth-service через Service Binding. */
export const AUTH_JWKS_PATH = '/api/auth/jwks';

/** Схема JWKS в том виде, в котором его отдаёт auth-service. */
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
 * Claims выданного JWT.
 *
 * Проверяются на границе: gateway не доверяет содержимому токена, пока
 * подпись не сверена с ключом из JWKS.
 */
export const AuthClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.email().optional(),
  name: z.string().optional(),
  /** Идентификатор сессии Better Auth — по нему можно отозвать доступ. */
  sessionId: z.string().optional(),
  exp: z.number(),
  iat: z.number().optional(),
});

export type AuthClaims = z.infer<typeof AuthClaimsSchema>;

/** Пользователь, определённый gateway из подписанного токена. */
export interface AuthenticatedUser {
  id: string;
  claims: AuthClaims;
}
