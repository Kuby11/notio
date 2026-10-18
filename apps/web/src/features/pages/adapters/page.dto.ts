import { z } from 'zod';
import {
  CreatePageInputSchema,
  MovePageInputSchema,
  PageListResultSchema,
  PageSchema,
  UpdatePageInputSchema,
} from '@notio/contracts';

/**
 * DTO-ответы pages-service.
 *
 * Сеть не считается доверенной: всё, что приходит, проверяется Zod до того,
 * как попадёт в доменную модель.
 */
export const PageResponseSchema = PageSchema;
export const PageListResponseSchema = PageListResultSchema;
export const CreatePageInputDTOSchema = CreatePageInputSchema;
export const UpdatePageInputDTOSchema = UpdatePageInputSchema;
export const MovePageInputDTOSchema = MovePageInputSchema;

// Схемы — runtime-значения, используем z явно, чтобы линтер не считал
// импорты из contracts «только типами».
export const PageResponseSchemaValidated = z.custom(
  (value) => PageResponseSchema.safeParse(value).success,
);

export type PageResponse = z.infer<typeof PageResponseSchema>;
export type PageListResponse = z.infer<typeof PageListResponseSchema>;
