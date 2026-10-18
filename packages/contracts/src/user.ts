import { z } from 'zod';
import { HttpUrlSchema, IdSchema, IsoDateTimeSchema } from './ids';

export const UserSchema = z.object({
  id: IdSchema,
  email: z.email(),
  name: z.string().min(1).max(120),
  imageUrl: HttpUrlSchema.optional(),
  createdAt: IsoDateTimeSchema,
});
export type User = z.infer<typeof UserSchema>;

/**
 * Публичные данные пользователя для других сервисов.
 *
 * Только то, что нужно показать рядом с ролью: почта и имя. Пароль, хеш и
 * внутренние поля наружу не отдаются — даже внутри системы.
 */
export const UserProfileSchema = z.object({
  id: IdSchema,
  email: z.email(),
  name: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserProfileListSchema = z.object({ items: z.array(UserProfileSchema) });

/** Сколько id можно запросить за один раз: ограничение защищает от раздутых ответов. */
export const MAX_USER_PROFILES_PER_REQUEST = 50;

export const UserProfilesQuerySchema = z.object({
  /** Список id через запятую: короткий и однозначный формат для query. */
  ids: z
    .string()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0),
    )
    .pipe(z.array(IdSchema).max(MAX_USER_PROFILES_PER_REQUEST)),
});
