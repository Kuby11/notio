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
