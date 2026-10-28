import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, PositionSchema } from './ids';

export const PageIconSchema = z.string().min(1).max(64);

export const PageSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  /** null — the page sits at the root of the workspace. */
  parentId: IdSchema.nullable(),
  title: z.string().max(500),
  icon: PageIconSchema.optional(),
  coverFileId: IdSchema.optional(),
  position: PositionSchema,
  isFavorite: z.boolean(),
  /** Trash is a soft delete: the row stays but is hidden from the tree. */
  isTrashed: z.boolean(),
  /**
   * Page lock: content and title become read-only.
   * The field is optional in the contract so older clients keep working; on
   * the server the column is always set (false by default).
   */
  isLocked: z.boolean().optional(),
  /**
   * Whether the page has non-deleted child pages.
   *
   * The server computes this field only in tree lists so the client does not
   * have to ask for the children of every collapsed node. Single-item
   * responses (create, PATCH, GET by id) may omit it.
   */
  hasChildren: z.boolean().optional(),
  createdBy: IdSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Page = z.infer<typeof PageSchema>;

export const CreatePageInputSchema = z.strictObject({
  workspaceId: IdSchema,
  parentId: IdSchema.nullable().default(null),
  title: z.string().max(500).default(''),
  icon: PageIconSchema.optional(),
  /** Insert right after the specified sibling page. */
  afterPageId: IdSchema.optional(),
});
export type CreatePageInput = z.infer<typeof CreatePageInputSchema>;

/**
 * Partial update. The object must contain at least one field: an empty PATCH
 * almost always means a client bug, not "change nothing".
 */
export const UpdatePageInputSchema = z
  .strictObject({
    title: z.string().max(500).optional(),
    icon: PageIconSchema.nullable().optional(),
    coverFileId: IdSchema.nullable().optional(),
    isFavorite: z.boolean().optional(),
    isTrashed: z.boolean().optional(),
    isLocked: z.boolean().optional(),
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

export const PageListResultSchema = z.object({
  items: z.array(PageSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type PageListResultResponse = z.infer<typeof PageListResultSchema>;
