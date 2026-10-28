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
 * Public user data for other services.
 *
 * Only what is needed next to a role: email and name. The password, its hash
 * and internal fields are never exposed — not even inside the system.
 */
export const UserProfileSchema = z.object({
  id: IdSchema,
  email: z.email(),
  name: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UserProfileListSchema = z.object({ items: z.array(UserProfileSchema) });

/** How many ids may be requested at once: the cap protects against bloated responses. */
export const MAX_USER_PROFILES_PER_REQUEST = 50;

export const UserProfilesQuerySchema = z.object({
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
