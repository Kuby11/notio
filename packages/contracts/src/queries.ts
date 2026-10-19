import { z } from 'zod';
import { IdSchema } from './ids';

/**
 * Query-параметры приходят строками, поэтому boolean разбираем явно:
 * в JS любая непустая строка истинна, из-за чего "false" стал бы true.
 */
export const BooleanQuerySchema = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

/**
 * Список дочерних страниц. `parentId: null` — корень рабочего пространства;
 * отсутствие параметра равнозначно корню.
 */
export const PageListQuerySchema = z.object({
  workspaceId: IdSchema,
  parentId: IdSchema.nullable().default(null),
  includeTrashed: BooleanQuerySchema.default(false),
  /** Курсор по position: следующая страница начинается строго после него. */
  cursor: z.string().min(1).max(256).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type PageListQuery = z.infer<typeof PageListQuerySchema>;

/**
 * Избранное собирается по всему рабочему пространству, а не по уровню дерева:
 * избранная страница может лежать на любой глубине вложенности.
 */
export const PageFavoritesQuerySchema = z.object({
  workspaceId: IdSchema,
});
export type PageFavoritesQuery = z.infer<typeof PageFavoritesQuerySchema>;

/** Корзина, как и избранное, собирается по всему workspace, а не по уровню дерева. */
export const PageTrashQuerySchema = z.object({
  workspaceId: IdSchema,
});
export type PageTrashQuery = z.infer<typeof PageTrashQuerySchema>;
