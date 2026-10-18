import { z } from 'zod';

/**
 * DTO ответов auth-service.
 *
 * Сеть не считается доверенной: всё, что приходит, проверяется Zod до того,
 * как попадёт в доменную модель. Пустое тело — валидный «нет сессии»,
 * поэтому схемы строятся на nullable/unknown, а не на предположениях.
 */

const UserSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  name: z.string(),
  emailVerified: z.boolean(),
});

/**
 * Ответ get-session: сессия и пользователь приходят отдельными объектами.
 * Клиент Better Auth превращает даты в `Date`, поэтому схема принимает оба вида.
 * Пустое тело (null) — валидный «нет сессии».
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
 * Тело ошибки Better Auth: код приходит в поле code, текст — в message.
 * Оба поля опциональны: прокси может вернуть problem+json без них.
 */
export const AuthErrorResponseSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  status: z.number().optional(),
});

export type SessionResponse = z.infer<typeof SessionResponseSchema>;
export type TokenResponse = z.infer<typeof TokenResponseSchema>;
export type AuthErrorResponse = z.infer<typeof AuthErrorResponseSchema>;
