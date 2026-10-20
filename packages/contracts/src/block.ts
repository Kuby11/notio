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
export interface ParagraphBlockContent {
  type: 'paragraph';
  content: string;
}

export interface HeadingBlockContent {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  content: string;
}

export interface BulletedListItemBlockContent {
  type: 'bulletedListItem';
  content: string;
}

export interface NumberedListItemBlockContent {
  type: 'numberedListItem';
  content: string;
}

export interface ToDoBlockContent {
  type: 'toDo';
  checked: boolean;
  content: string;
}

export interface QuoteBlockContent {
  type: 'quote';
  content: string;
}

export interface CodeBlockContent {
  type: 'code';
  language: string | null;
  content: string;
}

export interface DividerBlockContent {
  type: 'divider';
}

export interface ImageBlockContent {
  type: 'image';
  fileId: string;
  caption: string | null;
}

/**
 * Toggle — единственный контейнер в текущей модели.
 * Его дочерние блоки живут внутри строки toggle, а не отдельными строками
 * `blocks`: так открытое состояние и вложенный текст сохраняются атомарно.
 */
export interface ToggleBlockContent {
  type: 'toggle';
  content: string;
  /** false — содержимое свёрнуто. Отсутствие поля означает открытый toggle. */
  open?: boolean;
  children?: BlockContent[];
}

export type BlockContent =
  | ParagraphBlockContent
  | HeadingBlockContent
  | BulletedListItemBlockContent
  | NumberedListItemBlockContent
  | ToDoBlockContent
  | QuoteBlockContent
  | CodeBlockContent
  | DividerBlockContent
  | ImageBlockContent
  | ToggleBlockContent;

const BlockContentSchemaImpl: z.ZodType<BlockContent> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('paragraph'), content: z.string() }),
    z.strictObject({
      type: z.literal('heading'),
      level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
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
    z.strictObject({
      type: z.literal('toggle'),
      content: z.string(),
      open: z.boolean().optional(),
      children: z.array(BlockContentSchemaImpl).optional(),
    }),
  ]),
);

export const BlockContentSchema = BlockContentSchemaImpl;

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

/** Обновление блока: тип и содержимое меняются вместе, позиция — отдельно. */
export const UpdateBlockInputSchema = z
  .strictObject({
    content: BlockContentSchema.optional(),
    type: BlockTypeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Нужно передать хотя бы одно изменяемое поле',
  });
export type UpdateBlockInput = z.infer<typeof UpdateBlockInputSchema>;

/** Перемещение блока: новый родитель (страница та же) и сосед сверху. */
export const MoveBlockInputSchema = z.strictObject({
  afterBlockId: IdSchema.optional(),
});
export type MoveBlockInput = z.infer<typeof MoveBlockInputSchema>;

/** Ответ постраничного списка блоков. */
export const BlockListResultSchema = z.object({
  items: z.array(BlockSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type BlockListResult = z.infer<typeof BlockListResultSchema>;

/** Снапшот версии страницы: полный документ, а не дифф. */
export const PageVersionSchema = z.object({
  id: IdSchema,
  pageId: IdSchema,
  /** JSON-документ всех блоков страницы на момент сохранения. */
  content: z.array(BlockContentSchema),
  createdBy: IdSchema,
  createdAt: IsoDateTimeSchema,
});
export type PageVersion = z.infer<typeof PageVersionSchema>;
