import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, PositionSchema } from './ids';

/** Стандартные иконки и цвета обложек страниц. */
export const PageIconSchema = z.string().min(1).max(64);

export const PageSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  /** null — страница находится в корне рабочего пространства. */
  parentId: IdSchema.nullable(),
  title: z.string().max(500),
  icon: PageIconSchema.optional(),
  coverFileId: IdSchema.optional(),
  position: PositionSchema,
  isFavorite: z.boolean(),
  /** Корзина — мягкое удаление: строка остаётся, но скрыта из дерева. */
  isTrashed: z.boolean(),
  createdBy: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Page = z.infer<typeof PageSchema>;

/** То, что клиент присылает при создании страницы. */
export const CreatePageInputSchema = z.strictObject({
  workspaceId: IdSchema,
  parentId: IdSchema.nullable().default(null),
  title: z.string().max(500).default(''),
  icon: PageIconSchema.optional(),
  /** Вставка сразу после указанной соседней страницы. */
  afterPageId: IdSchema.optional(),
});
export type CreatePageInput = z.infer<typeof CreatePageInputSchema>;

/**
 * Частичное обновление. Объект обязан содержать хотя бы одно поле:
 * пустой PATCH почти всегда означает баг на клиенте, а не «ничего не менять».
 */
export const UpdatePageInputSchema = z
  .strictObject({
    title: z.string().max(500).optional(),
    icon: PageIconSchema.nullable().optional(),
    coverFileId: IdSchema.nullable().optional(),
    isFavorite: z.boolean().optional(),
    isTrashed: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Нужно передать хотя бы одно изменяемое поле',
  });
export type UpdatePageInput = z.infer<typeof UpdatePageInputSchema>;

export const MovePageInputSchema = z.strictObject({
  parentId: IdSchema.nullable(),
  afterPageId: IdSchema.optional(),
});
export type MovePageInput = z.infer<typeof MovePageInputSchema>;

/** Ответ постраничного списка страниц. */
export const PageListResultSchema = z.object({
  items: z.array(PageSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type PageListResultResponse = z.infer<typeof PageListResultSchema>;
