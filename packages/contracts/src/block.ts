import { z } from 'zod';
import { HttpUrlSchema, IdSchema, IsoDateTimeSchema, PositionSchema } from './ids';

/**
 * Editor block types. The set was frozen in Stage 1 so that block migrations
 * and the editor registry work against the same list (Stage 5).
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
  'video',
  'file',
  'emoji',
  'toggle',
  'table',
  'page',
  'columns',
  'equation',
  'linkToPage',
  'breadcrumb',
  'database',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BlockTypeSchema = z.enum(BLOCK_TYPES);

/**
 * Block colour palette — named presets, as in Notion.
 *
 * The colour lives in block content, not in marks: BlockContent stores flat
 * text without formatting, and a colour that cannot be persisted must not be
 * added in the first place (see ADR 0017). Presets instead of arbitrary hex
 * values keep light/dark themes consistent and validation simple.
 */
export const BLOCK_COLOR_PRESETS = [
  'gray',
  'brown',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'red',
] as const;

export type BlockColorPreset = (typeof BLOCK_COLOR_PRESETS)[number];

export const BlockColorPresetSchema = z.enum(BLOCK_COLOR_PRESETS);

/**
 * Inline text formatting (Tiptap marks), added with the rich-text stage.
 *
 * The schema mirrors the editor marks: bold/italic/strike/code are flags,
 * link is an http/https URL, color/backgroundColor are named presets
 * (the same palette as block colours, see ADR 0017/0021).
 */
export const INLINE_MARK_TYPES = [
  'bold',
  'italic',
  'strike',
  'code',
  'link',
  'color',
  'backgroundColor',
] as const;

export type InlineMarkType = (typeof INLINE_MARK_TYPES)[number];

export type InlineMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'link'; href: string }
  | { type: 'color'; color: BlockColorPreset }
  | { type: 'backgroundColor'; color: BlockColorPreset };

/** A run of text with uniform formatting. Empty marks means plain text. */
export interface InlineSegment {
  text: string;
  marks?: InlineMark[];
}

/**
 * Inline formula (LaTeX, rendered by KaTeX) — an atom inside rich text.
 * A separate segment variant rather than a mark: a formula has no text
 * that marks could be applied to.
 */
export interface MathSegment {
  math: string;
}

/**
 * Block text: a plain string (legacy data) or an array of segments with
 * marks. The editor mapping always writes arrays — strings are normalised
 * on the first autosave.
 */
export type RichText = string | (InlineSegment | MathSegment)[];

const InlineMarkSchema: z.ZodType<InlineMark> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('bold') }),
    z.strictObject({ type: z.literal('italic') }),
    z.strictObject({ type: z.literal('strike') }),
    z.strictObject({ type: z.literal('code') }),
    z.strictObject({ type: z.literal('link'), href: HttpUrlSchema }),
    z.strictObject({ type: z.literal('color'), color: BlockColorPresetSchema }),
    z.strictObject({ type: z.literal('backgroundColor'), color: BlockColorPresetSchema }),
  ]),
);

export const InlineSegmentSchema = z.strictObject({
  text: z.string().max(8000),
  marks: z.array(InlineMarkSchema).max(8).optional(),
});

export const MathSegmentSchema = z.strictObject({
  math: z.string().max(2000),
});

export const RichTextSchema: z.ZodType<RichText> = z.union([
  z.string(),
  z.array(z.union([InlineSegmentSchema, MathSegmentSchema])),
]);

/**
 * Block content — a discriminated union on the type.
 * Objects are strict: an extra field almost always means a typo in a name.
 * Stage 5 turns text fields into rich text (an array of inline nodes with
 * marks) — that needs a separate schema and migration.
 */
export interface ParagraphBlockContent {
  type: 'paragraph';
  content: RichText;
  /** Text colour of the block; a missing field means the default colour. */
  color?: BlockColorPreset;
  /** Background colour of the block; a missing field means no fill. */
  backgroundColor?: BlockColorPreset;
}

export interface HeadingBlockContent {
  type: 'heading';
  level: 1 | 2 | 3 | 4;
  content: RichText;
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

export interface BulletedListItemBlockContent {
  type: 'bulletedListItem';
  content: RichText;
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

export interface NumberedListItemBlockContent {
  type: 'numberedListItem';
  content: RichText;
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

export interface ToDoBlockContent {
  type: 'toDo';
  checked: boolean;
  content: RichText;
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

export interface QuoteBlockContent {
  type: 'quote';
  content: RichText;
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

export interface CodeBlockContent {
  type: 'code';
  language: string | null;
  content: string;
}

export interface DividerBlockContent {
  type: 'divider';
}

/**
 * Media blocks (image/video/file) have two modes: an uploaded file
 * (fileId — an object in R2 behind media-service) or an external link (url —
 * http/https only). Exactly one of the two sources must be filled in.
 */
export interface ImageBlockContent {
  type: 'image';
  fileId: string | null;
  url: string | null;
  caption: string | null;
  /** Image width as a percentage of the column (10–100); missing means 100%. */
  width?: number;
  /**
   * Wide mode: the image breaks out of the text column and its width is
   * `wideWidth` percent of the editor container (0–100; the value above the
   * column share is what makes it "wide"). Natural aspect, centred. Mutually
   * exclusive with `fullWidth` and the column-percent `width`.
   */
  wideWidth?: number;
  /**
   * true — the image spans the full workspace width (breaking out of the text
   * column) with a 16:9 frame. `width` still holds the last column percentage
   * and is restored when the image is narrowed back down.
   */
  fullWidth?: boolean;
}

export interface VideoBlockContent {
  type: 'video';
  fileId: string | null;
  url: string | null;
  caption: string | null;
}

export interface FileBlockContent {
  type: 'file';
  fileId: string | null;
  url: string | null;
  name: string;
  sizeBytes: number | null;
}

/** Emoji block: one large character (or a composite emoji without spaces). */
export interface EmojiBlockContent {
  type: 'emoji';
  emoji: string;
}

/**
 * Toggle — the only container in the current model.
 * Its child blocks live inside the toggle row rather than as separate `blocks`
 * rows, so the expanded state and the nested text are saved atomically.
 */
export interface ToggleBlockContent {
  type: 'toggle';
  content: RichText;
  /** false — content is collapsed. A missing field means the toggle is open. */
  open?: boolean;
  children?: BlockContent[];
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

/**
 * The table stores cell text row by row. Cells are plain text like every
 * other block: rich text inside tables arrives with the shared rich-text
 * work (Stage 5). All rows must have the same length.
 *
 * Geometry survives a reload as two arrays: colWidths — column widths in
 * pixels (after dragging a border), rowHeights — row heights. A null in
 * either array means automatic sizing.
 */
export interface TableBlockContent {
  type: 'table';
  /** true — the first row is rendered as the table header. */
  headerRow: boolean;
  rows: RichText[][];
  colWidths?: (number | null)[];
  rowHeights?: (number | null)[];
  /** Text colour of every cell; a missing field means the default colour. */
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

/**
 * Link to a child page — a "sub-page", as in Notion.
 *
 * The page itself is an ordinary `pages` row with parentId = the page that
 * owns the block. The block stores denormalised title/icon so it can render
 * without a page-list request; the live title stays on the page.
 */
export interface PageBlockContent {
  type: 'page';
  pageId: string;
  title: string;
  icon: string | null;
}

/**
 * Columns — the second container of the model: 2–5 columns, each with nested
 * blocks. Like toggle, the children live inside the columns row and are
 * saved atomically; there is nowhere to store a column width — columns are equal.
 */
export interface ColumnsBlockContent {
  type: 'columns';
  columns: {
    children?: BlockContent[];
  }[];
}

/** Block-level formula: LaTeX rendered by KaTeX on its own line. */
export interface EquationBlockContent {
  type: 'equation';
  expression: string;
}

/**
 * Link to an existing page (not a child one): it stores only the id, and the
 * rendering node fetches title and icon — the link stays correct after the
 * page is renamed.
 */
export interface LinkToPageBlockContent {
  type: 'linkToPage';
  pageId: string;
}

/** Breadcrumbs of the current page: the path is computed at render time. */
export interface BreadcrumbBlockContent {
  type: 'breadcrumb';
}

/**
 * Inline database: the block only references a `databases` row, which owns the
 * properties, views and rows. Keeping just the id lets the same database render
 * in several blocks and keeps inline databases independent of block content.
 */
export interface DatabaseBlockContent {
  type: 'database';
  databaseId: string;
  /**
   * Inline renders the database in the page; page renders a link to the
   * whole-page database. Missing means inline (older blocks).
   */
  display?: 'inline' | 'page';
  /**
   * Optional view to open for an inline block. Used by chart blocks inserted
   * from the slash menu so the page shows the requested chart instead of the
   * database's default table. Missing means the database default.
   */
  viewId?: string;
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
  | VideoBlockContent
  | FileBlockContent
  | EmojiBlockContent
  | ToggleBlockContent
  | TableBlockContent
  | PageBlockContent
  | ColumnsBlockContent
  | EquationBlockContent
  | LinkToPageBlockContent
  | BreadcrumbBlockContent
  | DatabaseBlockContent;

/**
 * Media blocks (image/video/file) must have a source: an uploaded file
 * (fileId) or an external link (url). Empty placeholders are never saved, so
 * "both null" must never occur in storage.
 */
const BlockContentSchemaImpl: z.ZodType<BlockContent> = z
  .lazy(() =>
    z.discriminatedUnion('type', [
      z.strictObject({
        type: z.literal('paragraph'),
        content: RichTextSchema,
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('heading'),
        level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
        content: RichTextSchema,
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('bulletedListItem'),
        content: RichTextSchema,
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('numberedListItem'),
        content: RichTextSchema,
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('toDo'),
        checked: z.boolean(),
        content: RichTextSchema,
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('quote'),
        content: RichTextSchema,
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('code'),
        language: z.string().max(32).nullable(),
        content: z.string(),
      }),
      z.strictObject({ type: z.literal('divider') }),
      z.strictObject({
        type: z.literal('image'),
        fileId: IdSchema.nullable(),
        url: HttpUrlSchema.nullable(),
        caption: z.string().max(500).nullable(),
        width: z.number().int().min(10).max(100).optional(),
        wideWidth: z.number().int().min(10).max(100).optional(),
        fullWidth: z.boolean().optional(),
      }),
      z.strictObject({
        type: z.literal('video'),
        fileId: IdSchema.nullable(),
        url: HttpUrlSchema.nullable(),
        caption: z.string().max(500).nullable(),
      }),
      z.strictObject({
        type: z.literal('file'),
        fileId: IdSchema.nullable(),
        url: HttpUrlSchema.nullable(),
        name: z.string().min(1).max(255),
        sizeBytes: z.number().int().nonnegative().nullable(),
      }),
      z.strictObject({
        type: z.literal('emoji'),
        emoji: z.string().min(1).max(16),
      }),
      z.strictObject({
        type: z.literal('toggle'),
        content: RichTextSchema,
        open: z.boolean().optional(),
        children: z.array(BlockContentSchemaImpl).optional(),
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('table'),
        headerRow: z.boolean(),
        rows: z.array(z.array(RichTextSchema).min(1).max(50)).min(1).max(100),
        colWidths: z.array(z.number().int().min(20).max(4000).nullable()).max(50).optional(),
        rowHeights: z.array(z.number().int().min(20).max(4000).nullable()).max(100).optional(),
        color: BlockColorPresetSchema.optional(),
        backgroundColor: BlockColorPresetSchema.optional(),
      }),
      z.strictObject({
        type: z.literal('page'),
        pageId: IdSchema,
        title: z.string().max(500),
        icon: z.string().min(1).max(64).nullable(),
      }),
      z.strictObject({
        type: z.literal('columns'),
        columns: z
          .array(
            z.strictObject({
              children: z.array(BlockContentSchemaImpl).optional(),
            }),
          )
          .min(2)
          .max(5),
      }),
      z.strictObject({
        type: z.literal('equation'),
        expression: z.string().max(2000),
      }),
      z.strictObject({
        type: z.literal('linkToPage'),
        pageId: IdSchema,
      }),
      z.strictObject({ type: z.literal('breadcrumb') }),
      z.strictObject({
        type: z.literal('database'),
        databaseId: IdSchema,
        display: z.enum(['inline', 'page']).optional(),
        viewId: IdSchema.optional(),
      }),
    ]),
  )
  .superRefine((value, ctx) => {
    const isMediaBlock = value.type === 'image' || value.type === 'video' || value.type === 'file';

    if (isMediaBlock && value.fileId === null && value.url === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'Media block requires a fileId or a url',
        path: [],
      });
    }
  });

export const BlockContentSchema = BlockContentSchemaImpl;

export const BlockSchema = z.object({
  id: IdSchema,
  pageId: IdSchema,
  type: BlockTypeSchema,
  position: PositionSchema,
  content: BlockContentSchema,
  /**
   * Author of the last content change. null for rows written before the
   * column existed; the editor then hides the "last edited by" line.
   */
  updatedBy: IdSchema.nullable().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Block = z.infer<typeof BlockSchema>;

/** Block creation: id and position are assigned by the service. */
export const CreateBlockInputSchema = z.strictObject({
  pageId: IdSchema,
  content: BlockContentSchema,
  afterBlockId: IdSchema.optional(),
});
export type CreateBlockInput = z.infer<typeof CreateBlockInputSchema>;

/** Block update: type and content change together, position separately. */
export const UpdateBlockInputSchema = z
  .strictObject({
    content: BlockContentSchema.optional(),
    type: BlockTypeSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one editable field is required',
  });
export type UpdateBlockInput = z.infer<typeof UpdateBlockInputSchema>;

/** Block move: new parent (same page) and the neighbour above. */
export const MoveBlockInputSchema = z.strictObject({
  afterBlockId: IdSchema.optional(),
});
export type MoveBlockInput = z.infer<typeof MoveBlockInputSchema>;

export const BlockListResultSchema = z.object({
  items: z.array(BlockSchema),
  nextCursor: z.string().min(1).nullable(),
});
export type BlockListResult = z.infer<typeof BlockListResultSchema>;

/** Page version snapshot: the full document, not a diff. */
export const PageVersionSchema = z.object({
  id: IdSchema,
  pageId: IdSchema,
  content: z.array(BlockContentSchema),
  createdBy: IdSchema,
  createdAt: IsoDateTimeSchema,
});
export type PageVersion = z.infer<typeof PageVersionSchema>;
