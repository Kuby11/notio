import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, PositionSchema } from './ids';

/**
 * Типы блоков редактора. Набор зафиксирован на Этапе 1, чтобы миграции
 * блоков и реестр редактора работали с одним списком (Этап 5).
 */
export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'bulletedListItem',
  'numberedListItem',
  'toDo',
  'quote',
  'code',
  'divider',
  'image',
  'toggle',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BlockTypeSchema = z.enum(BLOCK_TYPES);

/**
 * Содержимое блока — discriminated union по типу.
 * Объекты строгие: лишнее поле почти всегда означает опечатку в имени.
 * На Этапе 5 text-поля станут rich text (массив инлайн-узлов с marks) —
 * для этого добавится отдельная схема и миграция.
 */
export const BlockContentSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('paragraph'), content: z.string() }),
  z.strictObject({
    type: z.literal('heading'),
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    content: z.string(),
  }),
  z.strictObject({ type: z.literal('bulletedListItem'), content: z.string() }),
  z.strictObject({ type: z.literal('numberedListItem'), content: z.string() }),
  z.strictObject({ type: z.literal('toDo'), checked: z.boolean(), content: z.string() }),
  z.strictObject({ type: z.literal('quote'), content: z.string() }),
  z.strictObject({
    type: z.literal('code'),
    language: z.string().max(32).nullable(),
    content: z.string(),
  }),
  z.strictObject({ type: z.literal('divider') }),
  z.strictObject({
    type: z.literal('image'),
    fileId: IdSchema,
    caption: z.string().max(500).nullable(),
  }),
  z.strictObject({ type: z.literal('toggle'), content: z.string() }),
]);

export type BlockContent = z.infer<typeof BlockContentSchema>;

export const BlockSchema = z.object({
  id: IdSchema,
  pageId: IdSchema,
  type: BlockTypeSchema,
  position: PositionSchema,
  content: BlockContentSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Block = z.infer<typeof BlockSchema>;

/** Создание блока: id и позиция назначаются сервисом. */
export const CreateBlockInputSchema = z.strictObject({
  pageId: IdSchema,
  content: BlockContentSchema,
  afterBlockId: IdSchema.optional(),
});
export type CreateBlockInput = z.infer<typeof CreateBlockInputSchema>;
