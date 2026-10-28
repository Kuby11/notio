import { z } from 'zod';

/**
 * DTOs of auth-service responses.
 *
 * The network is not trusted: everything that arrives is checked by Zod before
 * entering the domain model. An empty body is a valid "no session", so the
 * schemas are built on nullable/unknown rather than on assumptions.
 */

export const UserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable().optional(),
});

/**
 * get-session response: session and user arrive as separate objects.
 * The Better Auth client turns dates into `Date`, so the schema accepts both.
 * An empty body (null) is a valid "no session".
 */
const SessionSchema = z.object({
  user: UserSchema,
  session: z.object({
    id: z.string().min(1),
    expiresAt: z.union([z.iso.datetime(), z.date()]),
  }),
});

export const SessionResponseSchema = z.union([SessionSchema, z.null()]);

export const SignUpResponseSchema = z.object({
  user: UserSchema,
  token: z.string().nullable(),
});

export const SignInResponseSchema = z.object({
  user: UserSchema,
  redirect: z.boolean().optional(),
});

export const TokenResponseSchema = z.object({ token: z.string().min(1) });

/**
 * Better Auth error body: the code comes in the `code` field, the text in `message`.
 * Both are optional: the proxy may return problem+json without them.
 */
export const AuthErrorResponseSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  status: z.number().optional(),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
