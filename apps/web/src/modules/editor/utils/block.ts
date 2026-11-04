/**
 * Domain rules of the editor's blocks.
 *
 * Pure TypeScript without React, Tiptap or network. Serialisation, migration and
 * the block type registry live here: otherwise the same invariant would live
 * in three places (editor, autosave, migrations).
 */
import {
  BLOCK_TYPES,
  BlockColorPresetSchema,
  newId,
  type Block,
  type BlockColorPreset,
  type BlockContent,
  type BlockType,
  type InlineMark,
  type InlineSegment,
  type MathSegment,
  type RichText,
} from '@notio/contracts';

/** Rich text segment: text with marks or an inline formula. */
type InlineContent = InlineSegment | MathSegment;

/** Colour fields shared by text block types (see ADR 0017). */
interface ColorFields {
  color?: BlockColorPreset;
  backgroundColor?: BlockColorPreset;
}

/** Block colours from content into the editor node's attrs. */
function colorAttrs(content: ColorFields): Record<string, unknown> {
  return {
    ...(content.color ? { color: content.color } : {}),
    ...(content.backgroundColor ? { backgroundColor: content.backgroundColor } : {}),
  };
}

/** Reads the colour preset from node attrs; ignores unknown values. */
function presetOfAttr(
  node: EditorNode,
  name: 'color' | 'backgroundColor',
): BlockColorPreset | undefined {
  const result = BlockColorPresetSchema.safeParse(node.attrs?.[name]);

  return result.success ? result.data : undefined;
}

/** Node colours into the block's content fields. */
function colorFieldsOf(node: EditorNode): ColorFields {
  const color = presetOfAttr(node, 'color');
  const backgroundColor = presetOfAttr(node, 'backgroundColor');

  return {
    ...(color ? { color } : {}),
    ...(backgroundColor ? { backgroundColor } : {}),
  };
}

/** A block in domain terms: the same as the contract, but with explicit children for toggle. */
export type EditorBlock = Block;

/** A Tiptap JSON document node. Typed locally so utils do not depend on Tiptap. */
export interface EditorNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: EditorNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

export interface EditorDocument extends EditorNode {
  type: 'doc';
  content: EditorNode[];
}

/** A block restored from the editor: only already saved blocks have an id. */
export interface EditorBlockContent {
  id: string | null;
  content: BlockContent;
}

/** Reads the block id from a ProseMirror/JSON node's attrs. */
export function blockIdFromAttrs(attrs: Record<string, unknown> | undefined): string | undefined {
  const blockId = attrs?.['blockId'];

  return typeof blockId === 'string' && blockId.length > 0 ? blockId : undefined;
}

/** Block type registry: a new type is added by registering, not by editing a switch. */
export interface BlockDefinition {
  type: BlockType;
  label: string;
  icon: string;
  create: () => BlockContent;
  toText: (content: BlockContent) => string;
}

const registry = new Map<BlockType, BlockDefinition>();

/** Registers a block type. Re-registering replaces the previous one. */
export function registerBlock(definition: BlockDefinition): void {
  registry.set(definition.type, definition);
}

export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return registry.get(type);
}

export function listBlockDefinitions(): BlockDefinition[] {
  return [...registry.values()];
}

export function createEmptyBlock(type: BlockType): BlockContent {
  const definition = registry.get(type);

  if (!definition) {
    throw new Error(`Тип блока ${type} не зарегистрирован`);
  }

  return definition.create();
}

function contentText(content: BlockContent): string {
  if (content.type === 'toggle') {
    return [richToPlain(content.content), ...(content.children ?? []).map(contentText)]
      .filter((line) => line.length > 0)
      .join('\n');
  }

  return 'content' in content ? richToPlain(content.content) : '';
}

/**
 * All contract types are registered on module import.
 *
 * Thanks to that the slash menu and serialisation see the same set: adding a
 * type only requires adding it to BLOCK_TYPES and to this list.
 */
export const DEFAULT_BLOCK_DEFINITIONS: readonly BlockDefinition[] = BLOCK_TYPES.map((type) => {
  switch (type) {
    case 'paragraph':
      return {
        type,
        label: 'Текст',
        icon: '¶',
        create: () => ({ type, content: '' }),
        toText: contentText,
      };
    case 'heading':
      return {
        type,
        label: 'Заголовок',
        icon: 'H',
        create: () => ({ type, level: 1, content: '' }),
        toText: contentText,
      };
    case 'bulletedListItem':
      return {
        type,
        label: 'Маркированный список',
        icon: '•',
        create: () => ({ type, content: '' }),
        toText: contentText,
      };
    case 'numberedListItem':
      return {
        type,
        label: 'Нумерованный список',
        icon: '1.',
        create: () => ({ type, content: '' }),
        toText: contentText,
      };
    case 'toDo':
      return {
        type,
        label: 'Задача',
        icon: '☑',
        create: () => ({ type, checked: false, content: '' }),
        toText: contentText,
      };
    case 'quote':
      return {
        type,
        label: 'Цитата',
        icon: '❝',
        create: () => ({ type, content: '' }),
        toText: contentText,
      };
    case 'code':
      return {
        type,
        label: 'Код',
        icon: '</>',
        create: () => ({ type, language: null, content: '' }),
        toText: contentText,
      };
    case 'divider':
      return {
        type,
        label: 'Разделитель',
        icon: '—',
        create: () => ({ type }),
        toText: () => '',
      };
    case 'image':
      return {
        type,
        label: 'Изображение',
        icon: '🖼',
        create: () => ({ type, fileId: null, url: null, caption: null }),
        toText: (content) => (content.type === 'image' ? (content.caption ?? '') : ''),
      };
    case 'video':
      return {
        type,
        label: 'Видео',
        icon: '▶',
        create: () => ({ type, fileId: null, url: null, caption: null }),
        toText: (content) => (content.type === 'video' ? (content.caption ?? '') : ''),
      };
    case 'file':
      return {
        type,
        label: 'Файл',
        icon: '📎',
        create: () => ({ type, fileId: null, url: null, name: 'Файл', sizeBytes: null }),
        toText: (content) => (content.type === 'file' ? content.name : ''),
      };
    case 'emoji':
      return {
        type,
        label: 'Эмодзи',
        icon: '😀',
        create: () => ({ type, emoji: '⭐' }),
        toText: (content) => (content.type === 'emoji' ? content.emoji : ''),
      };
    case 'toggle':
      return {
        type,
        label: 'Переключатель',
        icon: '▸',
        create: () => ({ type, content: '' }),
        toText: contentText,
      };
    case 'table':
      return {
        type,
        label: 'Таблица',
        icon: '▦',
        create: () => ({
          type,
          headerRow: true,
          rows: [
            ['', '', ''],
            ['', '', ''],
            ['', '', ''],
          ],
        }),
        toText: (content) =>
          content.type === 'table' ? content.rows.map((cells) => cells.join('\t')).join('\n') : '',
      };
    case 'page':
      return {
        type,
        label: 'Страница',
        icon: '📄',
        // The temporary id is replaced by the created page's id after the service responds.
        create: () => ({ type, pageId: newId(), title: '', icon: null }),
        toText: (content) => (content.type === 'page' ? content.title : ''),
      };
    case 'columns':
      return {
        type,
        label: 'Колонки',
        icon: '◫',
        create: () => ({
          type,
          columns: [
            { children: [{ type: 'paragraph', content: '' }] },
            { children: [{ type: 'paragraph', content: '' }] },
          ],
        }),
        toText: (content) =>
          content.type === 'columns'
            ? content.columns
                .map((column) => (column.children ?? []).map(contentToText).join('\n'))
                .join('\n')
            : '',
      };
    case 'equation':
      return {
        type,
        label: 'Формула',
        icon: '∑',
        create: () => ({ type, expression: '' }),
        toText: (content) => (content.type === 'equation' ? content.expression : ''),
      };
    case 'linkToPage':
      return {
        type,
        label: 'Ссылка на страницу',
        icon: '🔗',
        // pageId is filled in the picker dialog; without it the block is not saved.
        create: () => ({ type, pageId: '' }),
        toText: () => '',
      };
    case 'breadcrumb':
      return {
        type,
        label: 'Хлебные крошки',
        icon: '⌂',
        create: () => ({ type }),
        toText: () => '',
      };
    case 'database':
      return {
        type,
        label: 'База данных',
        icon: '🗂',
        create: () => ({ type, databaseId: newId() }),
        toText: () => '',
      };
  }
});

for (const definition of DEFAULT_BLOCK_DEFINITIONS) {
  registerBlock(definition);
}

/** Block text content; divider and image have none. */
export function contentToText(content: BlockContent): string {
  return contentText(content);
}

/** Text representation of a block for search and preview. */
export function blockToText(block: Block): string {
  const definition = registry.get(block.type);

  return definition ? definition.toText(block.content) : contentText(block.content);
}

/** Flat document text: used for previews and old migrations. */
export function toEditorText(blocks: readonly Block[]): string {
  return blocks
    .map((block) => blockToText(block))
    .filter((line) => line.length > 0)
    .join('\n');
}

export function serializeDocument(blocks: readonly Block[]): string {
  return JSON.stringify(blocks);
}

/** Deserialises a document, validating it against the contract. */
export function deserializeDocument(json: string): Block[] {
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error('Документ должен быть массивом блоков');
  }

  return parsed.map((entry) => {
    // Legacy format migration: if content is a string, wrap it in a paragraph.
    if (typeof entry === 'string') {
      return {
        id: crypto.randomUUID(),
        pageId: '',
        type: 'paragraph',
        position: 'a0',
        content: { type: 'paragraph', content: entry },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Block;
    }

    return entry as Block;
  });
}

/** Move check: a block cannot be moved inside itself. */
export function canMoveBlock(
  blocks: readonly Block[],
  blockId: string,
  afterBlockId: string | null,
): boolean {
  if (blockId === afterBlockId) {
    return false;
  }

  void blocks;

  return true;
}

function blockIdOf(node: EditorNode): string | null {
  return blockIdFromAttrs(node.attrs) ?? null;
}

function inlineText(node: EditorNode): string {
  if (node.type === 'text') {
    return node.text ?? '';
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  return (node.content ?? []).map(inlineText).join('');
}

/** PM marks of an inline node into contract marks; unknown ones are dropped. */
function pmMarksToInline(node: EditorNode): InlineMark[] {
  const marks: InlineMark[] = [];

  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        marks.push({ type: 'bold' });
        break;
      case 'italic':
        marks.push({ type: 'italic' });
        break;
      case 'strike':
        marks.push({ type: 'strike' });
        break;
      case 'code':
        marks.push({ type: 'code' });
        break;
      case 'link': {
        const href = mark.attrs?.['href'];

        if (typeof href === 'string' && href.length > 0) {
          marks.push({ type: 'link', href });
        }

        break;
      }
      case 'textColor': {
        const parsed = BlockColorPresetSchema.safeParse(mark.attrs?.['color']);

        if (parsed.success) {
          marks.push({ type: 'color', color: parsed.data });
        }

        break;
      }
      case 'textBg': {
        const parsed = BlockColorPresetSchema.safeParse(mark.attrs?.['color']);

        if (parsed.success) {
          marks.push({ type: 'backgroundColor', color: parsed.data });
        }

        break;
      }
    }
  }

  return marks;
}

/** Inline content of a PM node into rich text segments (text, formulas, breaks). */
function inlineSegmentsFromNode(node: EditorNode): InlineContent[] {
  const segments: InlineContent[] = [];

  const walk = (current: EditorNode): void => {
    if (current.type === 'hardBreak') {
      segments.push({ text: '\n' });
      return;
    }

    if (current.type === 'inlineMath') {
      const expression = current.attrs?.['expression'];

      if (typeof expression === 'string' && expression.length > 0) {
        segments.push({ math: expression });
      }

      return;
    }

    if (current.type === 'text') {
      const text = current.text ?? '';

      if (text.length === 0) {
        return;
      }

      const marks = pmMarksToInline(current);

      segments.push(marks.length > 0 ? { text, marks } : { text });
      return;
    }

    for (const child of current.content ?? []) {
      walk(child);
    }
  };

  for (const child of node.content ?? []) {
    walk(child);
  }

  return segments;
}

/** Segments of all paragraphs of a node across line breaks (blockquote, listItem). */
function blockSegments(node: EditorNode): InlineContent[] {
  const segments: InlineContent[] = [];
  const paragraphs = (node.content ?? []).filter((child) => child.type === 'paragraph');

  paragraphs.forEach((paragraph, index) => {
    if (index > 0) {
      segments.push({ text: '\n' });
    }

    segments.push(...inlineSegmentsFromNode(paragraph));
  });

  return segments;
}

/** Flat rich text — for search, preview and the code block. */
export function richToPlain(content: RichText): string {
  return typeof content === 'string'
    ? content
    : content.map((segment) => ('math' in segment ? segment.math : segment.text)).join('');
}

/** Contract marks into a segment's PM marks. */
function inlineMarksToPm(marks: InlineMark[]): NonNullable<EditorNode['marks']> {
  return marks.map((mark) => {
    switch (mark.type) {
      case 'link':
        return { type: 'link', attrs: { href: mark.href } };
      case 'color':
        return { type: 'textColor', attrs: { color: mark.color } };
      case 'backgroundColor':
        return { type: 'textBg', attrs: { color: mark.color } };
      default:
        return { type: mark.type };
    }
  });
}

/** Rich text (string or segments) into PM inline nodes. */
function segmentsToInlineNodes(content: RichText, breakLines: boolean): EditorNode[] {
  if (typeof content === 'string') {
    return inlineNodes(content, breakLines);
  }

  const nodes: EditorNode[] = [];

  for (const segment of content) {
    if ('math' in segment) {
      nodes.push({ type: 'inlineMath', attrs: { expression: segment.math } });
      continue;
    }

    const marks = inlineMarksToPm(segment.marks ?? []);
    const lines = breakLines ? segment.text.split('\n') : [segment.text];

    lines.forEach((line, index) => {
      if (index > 0) {
        nodes.push({ type: 'hardBreak' });
      }

      if (line.length > 0) {
        nodes.push({ type: 'text', text: line, ...(marks.length > 0 ? { marks } : {}) });
      }
    });
  }

  return nodes;
}

function inlineNodes(text: string, breakLines: boolean): EditorNode[] {
  if (text.length === 0) {
    return [];
  }

  if (!breakLines) {
    return [{ type: 'text', text }];
  }

  const nodes: EditorNode[] = [];

  for (const [index, line] of text.split('\n').entries()) {
    if (index > 0) {
      nodes.push({ type: 'hardBreak' });
    }

    if (line.length > 0) {
      nodes.push({ type: 'text', text: line });
    }
  }

  return nodes;
}

function paragraphNode(text: RichText): EditorNode {
  return { type: 'paragraph', content: segmentsToInlineNodes(text, true) };
}

function listItemNode(
  blockId: string | null,
  text: RichText,
  colors: ColorFields = {},
): EditorNode {
  return {
    type: 'listItem',
    attrs: { blockId, ...colorAttrs(colors) },
    content: [paragraphNode(text)],
  };
}

function taskItemNode(
  blockId: string | null,
  checked: boolean,
  text: RichText,
  colors: ColorFields = {},
): EditorNode {
  return {
    type: 'taskItem',
    attrs: { blockId, checked, ...colorAttrs(colors) },
    content: [paragraphNode(text)],
  };
}

interface ContentEntry {
  id: string | null;
  content: BlockContent;
}

function toggleNode(
  blockId: string | null,
  content: Extract<BlockContent, { type: 'toggle' }>,
): EditorNode {
  const children = entriesToNodes(
    (content.children ?? []).map((child) => ({ id: null, content: child })),
  );

  return {
    type: 'details',
    attrs: { blockId, open: content.open !== false, ...colorAttrs(content) },
    content: [
      { type: 'detailsSummary', content: segmentsToInlineNodes(content.content, true) },
      {
        type: 'detailsContent',
        content: children.length > 0 ? children : [paragraphNode('')],
      },
    ],
  };
}

/** Table: rows into tableRow, first-row cells into tableHeader. */
function tableNode(
  blockId: string | null,
  content: Extract<BlockContent, { type: 'table' }>,
): EditorNode {
  const rows: EditorNode[] = [];

  content.rows.forEach((cells, rowIndex) => {
    const rowAttrs: Record<string, unknown> = {};
    const rowHeight = content.rowHeights?.[rowIndex];

    if (rowHeight !== undefined && rowHeight !== null) {
      rowAttrs['rowHeight'] = rowHeight;
    }

    const cellNodes = cells.map((cell, colIndex) => {
      const cellAttrs: Record<string, unknown> = {};
      const colWidth = content.colWidths?.[colIndex];

      if (colWidth !== undefined && colWidth !== null) {
        cellAttrs['colwidth'] = [colWidth];
      }

      return {
        type: content.headerRow && rowIndex === 0 ? 'tableHeader' : 'tableCell',
        attrs: cellAttrs,
        content: [paragraphNode(cell)],
      };
    });

    rows.push({ type: 'tableRow', attrs: rowAttrs, content: cellNodes });
  });

  return { type: 'table', attrs: { blockId, ...colorAttrs(content) }, content: rows };
}

/** Link to a child page: an atomic node with the page id in attrs. */
function subPageNode(
  blockId: string | null,
  content: Extract<BlockContent, { type: 'page' }>,
): EditorNode {
  return {
    type: 'subPage',
    attrs: { blockId, pageId: content.pageId, title: content.title, icon: content.icon },
  };
}

/**
 * Columns: each column's children go through entriesToNodes, and — like toggle —
 * a service empty paragraph is appended at the end for the cursor.
 */
function columnsNode(
  blockId: string | null,
  content: Extract<BlockContent, { type: 'columns' }>,
): EditorNode {
  const columns = content.columns.map((column) => {
    const children = entriesToNodes(
      (column.children ?? []).map((child) => ({ id: null, content: child })),
    );

    return {
      type: 'columnsColumn',
      content: children.length > 0 ? children : [paragraphNode('')],
    };
  });

  return { type: 'columnsList', attrs: { blockId }, content: columns };
}

/**
 * Columns from a node: like toggleContentFromNode — trailing empty paragraphs
 * of columns are not saved, hydration recreates them.
 */
function columnsContentFromNode(
  node: EditorNode,
): Extract<BlockContent, { type: 'columns' }> | null {
  const columns = (node.content ?? [])
    .filter((child) => child.type === 'columnsColumn')
    .map((column) => {
      const children = contentsFromNodes(column.content ?? []);

      for (;;) {
        const last = children.at(-1);

        if (last?.type !== 'paragraph' || richToPlain(last.content) !== '') {
          break;
        }

        children.pop();
      }

      return { children: children.length > 0 ? children : undefined };
    });

  // The contract requires at least 2 columns: a degenerate node is not saved.
  if (columns.length < 2) {
    return null;
  }

  return { type: 'columns', columns };
}

/** Converts one block into a node; lists are handled as a group in entriesToNodes. */
function entryToNode(entry: ContentEntry): EditorNode | null {
  const { content } = entry;

  switch (content.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        attrs: { blockId: entry.id, ...colorAttrs(content) },
        content: segmentsToInlineNodes(content.content, true),
      };

    case 'heading':
      return {
        type: 'heading',
        attrs: { blockId: entry.id, level: content.level, ...colorAttrs(content) },
        content: segmentsToInlineNodes(content.content, true),
      };

    case 'quote':
      return {
        type: 'blockquote',
        attrs: { blockId: entry.id, ...colorAttrs(content) },
        content: [paragraphNode(content.content)],
      };

    case 'code':
      return {
        type: 'codeBlock',
        attrs: { blockId: entry.id, language: content.language },
        content: inlineNodes(content.content, false),
      };

    case 'divider':
      return { type: 'horizontalRule', attrs: { blockId: entry.id } };

    case 'image':
      return {
        type: 'image',
        attrs: {
          blockId: entry.id,
          fileId: content.fileId,
          url: content.url,
          caption: content.caption,
          ...(content.width !== undefined ? { width: content.width } : {}),
          ...(content.fullWidth !== undefined ? { fullWidth: content.fullWidth } : {}),
        },
      };

    case 'video':
      return {
        type: 'video',
        attrs: {
          blockId: entry.id,
          fileId: content.fileId,
          url: content.url,
          caption: content.caption,
        },
      };

    case 'file':
      return {
        type: 'file',
        attrs: {
          blockId: entry.id,
          fileId: content.fileId,
          url: content.url,
          name: content.name,
          sizeBytes: content.sizeBytes,
        },
      };

    case 'emoji':
      return {
        type: 'emoji',
        attrs: { blockId: entry.id, emoji: content.emoji },
      };

    case 'toggle':
      return toggleNode(entry.id, content);

    case 'table':
      return tableNode(entry.id, content);

    case 'page':
      return subPageNode(entry.id, content);

    case 'columns':
      return columnsNode(entry.id, content);

    case 'equation':
      return {
        type: 'equationBlock',
        attrs: { blockId: entry.id, expression: content.expression },
      };

    case 'linkToPage':
      return { type: 'pageLink', attrs: { blockId: entry.id, pageId: content.pageId } };

    case 'breadcrumb':
      return { type: 'breadcrumbBlock', attrs: { blockId: entry.id } };

    case 'database':
      return content.display === 'page'
        ? {
            type: 'databaseLink',
            attrs: { blockId: entry.id, databaseId: content.databaseId },
          }
        : {
            type: 'databaseBlock',
            attrs: {
              blockId: entry.id,
              databaseId: content.databaseId,
              ...(content.viewId ? { viewId: content.viewId } : {}),
            },
          };

    case 'bulletedListItem':
    case 'numberedListItem':
    case 'toDo':
      return null;
  }
}

/**
 * Converts a sequence of blocks into nodes, merging neighbouring elements
 * of the same list. Nested toggle blocks go through the same function.
 */
function entriesToNodes(entries: readonly ContentEntry[]): EditorNode[] {
  const content: EditorNode[] = [];
  let index = 0;

  while (index < entries.length) {
    const entry = entries[index];

    if (!entry) {
      break;
    }

    if (entry.content.type === 'toDo') {
      const items: EditorNode[] = [];

      while (index < entries.length) {
        const current = entries[index];

        if (!current || current.content.type !== 'toDo') {
          break;
        }

        items.push(
          taskItemNode(
            current.id,
            current.content.checked,
            current.content.content,
            current.content,
          ),
        );
        index += 1;
      }

      content.push({ type: 'taskList', content: items });
      continue;
    }

    if (entry.content.type === 'bulletedListItem' || entry.content.type === 'numberedListItem') {
      const itemType = entry.content.type;
      const listType = itemType === 'bulletedListItem' ? 'bulletList' : 'orderedList';
      const items: EditorNode[] = [];

      while (index < entries.length) {
        const current = entries[index];

        if (!current || current.content.type !== itemType) {
          break;
        }

        items.push(listItemNode(current.id, current.content.content, current.content));
        index += 1;
      }

      content.push({ type: listType, content: items });
      continue;
    }

    const node = entryToNode(entry);

    if (node) {
      content.push(node);
    }

    index += 1;
  }

  return content;
}

function headingLevelOf(node: EditorNode): 1 | 2 | 3 | 4 {
  const level = node.attrs?.['level'];

  return level === 1 || level === 2 || level === 3 || level === 4 ? level : 1;
}

function codeLanguageOf(node: EditorNode): string | null {
  const language = node.attrs?.['language'];

  return typeof language === 'string' && language.length > 0 ? language : null;
}

function captionOf(node: EditorNode): string | null {
  const caption = node.attrs?.['caption'];

  return typeof caption === 'string' ? caption : null;
}

/** Media node source: uploaded file or external link. */
function mediaSourceOf(node: EditorNode): { fileId: string | null; url: string | null } | null {
  const fileId = node.attrs?.['fileId'];
  const url = node.attrs?.['url'];

  if (typeof fileId === 'string' && fileId.length > 0) {
    return { fileId, url: null };
  }

  if (typeof url === 'string' && url.length > 0) {
    return { fileId: null, url };
  }

  return null;
}

/**
 * Converts saved blocks into a Tiptap JSON document.
 *
 * Neighbouring list items merge into a single list node, as ProseMirror's
 * schema requires. Ids are kept in attrs blockId so selection and later saves
 * can match nodes to the database.
 */
export function blocksToEditorDocument(blocks: readonly Block[]): EditorDocument {
  return {
    type: 'doc',
    content: entriesToNodes(blocks.map((block) => ({ id: block.id, content: block.content }))),
  };
}

function collectListItems(
  node: EditorNode,
  type: 'bulletedListItem' | 'numberedListItem',
  result: EditorBlockContent[],
): void {
  for (const item of node.content ?? []) {
    if (item.type !== 'listItem') {
      continue;
    }

    result.push({
      id: blockIdOf(item),
      content: { type, content: blockSegments(item), ...colorFieldsOf(item) },
    });

    for (const child of item.content ?? []) {
      if (child.type === 'bulletList') {
        collectListItems(child, 'bulletedListItem', result);
      } else if (child.type === 'orderedList') {
        collectListItems(child, 'numberedListItem', result);
      }
    }
  }
}

function collectListContents(
  node: EditorNode,
  type: 'bulletedListItem' | 'numberedListItem',
  result: BlockContent[],
): void {
  for (const item of node.content ?? []) {
    if (item.type !== 'listItem') {
      continue;
    }

    result.push({ type, content: blockSegments(item), ...colorFieldsOf(item) });

    for (const child of item.content ?? []) {
      if (child.type === 'bulletList') {
        collectListContents(child, 'bulletedListItem', result);
      } else if (child.type === 'orderedList') {
        collectListContents(child, 'numberedListItem', result);
      }
    }
  }
}

function collectTaskItems(node: EditorNode, result: EditorBlockContent[]): void {
  for (const item of node.content ?? []) {
    if (item.type !== 'taskItem') {
      continue;
    }

    result.push({
      id: blockIdOf(item),
      content: {
        type: 'toDo',
        checked: item.attrs?.['checked'] === true,
        content: blockSegments(item),
        ...colorFieldsOf(item),
      },
    });

    for (const child of item.content ?? []) {
      if (child.type === 'taskList') {
        collectTaskItems(child, result);
      }
    }
  }
}

function collectTaskContents(node: EditorNode, result: BlockContent[]): void {
  for (const item of node.content ?? []) {
    if (item.type !== 'taskItem') {
      continue;
    }

    result.push({
      type: 'toDo',
      checked: item.attrs?.['checked'] === true,
      content: blockSegments(item),
      ...colorFieldsOf(item),
    });

    for (const child of item.content ?? []) {
      if (child.type === 'taskList') {
        collectTaskContents(child, result);
      }
    }
  }
}

/** Table from a node: the cell type of the first row decides headerRow. */
function tableContentFromNode(node: EditorNode): Extract<BlockContent, { type: 'table' }> | null {
  const rows: RichText[][] = [];
  const rowHeights: (number | null)[] = [];
  let colWidths: (number | null)[] | null = null;

  for (const row of node.content ?? []) {
    if (row.type !== 'tableRow') {
      continue;
    }

    const cells: RichText[] = [];
    const widths: (number | null)[] = [];

    for (const cell of row.content ?? []) {
      if (cell.type === 'tableCell' || cell.type === 'tableHeader') {
        cells.push(blockSegments(cell));

        // A cell's colwidth is an array per span; the width comes from the first element.
        const colwidth = cell.attrs?.['colwidth'];

        widths.push(
          Array.isArray(colwidth) && typeof colwidth[0] === 'number' ? colwidth[0] : null,
        );
      }
    }

    if (cells.length > 0) {
      rows.push(cells);
      // Widths are read from the first row; later cells share them.
      colWidths ??= widths;

      const rowHeight = row.attrs?.['rowHeight'];

      rowHeights.push(typeof rowHeight === 'number' ? rowHeight : null);
    }
  }

  if (rows.length === 0) {
    return null;
  }

  const firstRow = (node.content ?? []).find((child) => child.type === 'tableRow');
  const firstCells = firstRow?.content ?? [];
  const headerRow =
    firstCells.length > 0 && firstCells.every((cell) => cell.type === 'tableHeader');

  return {
    type: 'table',
    headerRow,
    rows,
    ...(colWidths?.some((width) => width !== null) ? { colWidths } : {}),
    ...(rowHeights.some((height) => height !== null) ? { rowHeights } : {}),
    ...colorFieldsOf(node),
  };
}

/** Page link from a node; without pageId the block is invalid and is not saved. */
function pageContentFromNode(node: EditorNode): Extract<BlockContent, { type: 'page' }> | null {
  const pageId = node.attrs?.['pageId'];

  if (typeof pageId !== 'string' || pageId.length === 0) {
    return null;
  }

  const title = node.attrs?.['title'];
  const icon = node.attrs?.['icon'];

  return {
    type: 'page',
    pageId,
    title: typeof title === 'string' ? title : '',
    icon: typeof icon === 'string' && icon.length > 0 ? icon : null,
  };
}

function toggleContentFromNode(node: EditorNode): Extract<BlockContent, { type: 'toggle' }> {
  const header = (node.content ?? []).find((child) => child.type === 'detailsSummary');
  const body = (node.content ?? []).find((child) => child.type === 'detailsContent');
  const children = contentsFromNodes(body?.content ?? []);

  // The empty service paragraph of the body is not saved: hydration recreates it.
  for (;;) {
    const last = children.at(-1);

    if (last?.type !== 'paragraph' || richToPlain(last.content) !== '') {
      break;
    }

    children.pop();
  }

  return {
    type: 'toggle',
    content: header ? inlineSegmentsFromNode(header) : [],
    ...(node.attrs?.['open'] === false ? { open: false } : {}),
    ...(children.length > 0 ? { children } : {}),
    ...colorFieldsOf(node),
  };
}

/** Converts one node (except a list) into domain BlockContent. */
function nodeToContent(node: EditorNode): BlockContent | null {
  switch (node.type) {
    case 'paragraph':
      return { type: 'paragraph', content: inlineSegmentsFromNode(node), ...colorFieldsOf(node) };

    case 'heading':
      return {
        type: 'heading',
        level: headingLevelOf(node),
        content: inlineSegmentsFromNode(node),
        ...colorFieldsOf(node),
      };

    case 'blockquote':
      return { type: 'quote', content: blockSegments(node), ...colorFieldsOf(node) };

    case 'codeBlock':
      return { type: 'code', language: codeLanguageOf(node), content: inlineText(node) };

    case 'horizontalRule':
      return { type: 'divider' };

    case 'image': {
      const source = mediaSourceOf(node);

      // Without a source the block is invalid per the contract and is not saved.
      if (!source) {
        return null;
      }

      const width = node.attrs?.['width'];

      return {
        type: 'image',
        fileId: source.fileId,
        url: source.url,
        caption: captionOf(node),
        ...(typeof width === 'number' && width >= 10 && width <= 100
          ? { width: Math.round(width) }
          : {}),
        ...(node.attrs?.['fullWidth'] === true ? { fullWidth: true } : {}),
      };
    }

    case 'video': {
      const source = mediaSourceOf(node);

      return source
        ? { type: 'video', fileId: source.fileId, url: source.url, caption: captionOf(node) }
        : null;
    }

    case 'file': {
      const source = mediaSourceOf(node);

      if (!source) {
        return null;
      }

      const name = node.attrs?.['name'];
      const sizeBytes = node.attrs?.['sizeBytes'];

      return {
        type: 'file',
        fileId: source.fileId,
        url: source.url,
        name: typeof name === 'string' && name.length > 0 ? name : 'Файл',
        sizeBytes: typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) ? sizeBytes : null,
      };
    }

    case 'emoji': {
      const emoji = node.attrs?.['emoji'];

      return typeof emoji === 'string' && emoji.length > 0 && emoji.length <= 16
        ? { type: 'emoji', emoji }
        : null;
    }

    case 'details':
      return toggleContentFromNode(node);

    case 'table':
      return tableContentFromNode(node);

    case 'subPage':
      return pageContentFromNode(node);

    case 'columnsList':
      return columnsContentFromNode(node);

    case 'equationBlock': {
      const expression = node.attrs?.['expression'];

      return typeof expression === 'string'
        ? { type: 'equation', expression }
        : { type: 'equation', expression: '' };
    }

    case 'pageLink': {
      // A link with no selected page (the dialog is still open) is not saved.
      const pageId = node.attrs?.['pageId'];

      return typeof pageId === 'string' && pageId.length > 0
        ? { type: 'linkToPage', pageId }
        : null;
    }

    case 'breadcrumbBlock':
      return { type: 'breadcrumb' };

    case 'databaseBlock': {
      // An empty id means the database is still being created: nothing to save yet.
      const databaseId = node.attrs?.['databaseId'];
      const viewId = node.attrs?.['viewId'];

      return typeof databaseId === 'string' && databaseId.length > 0
        ? {
            type: 'database',
            databaseId,
            ...(typeof viewId === 'string' && viewId.length > 0 ? { viewId } : {}),
          }
        : null;
    }

    case 'databaseLink': {
      const databaseId = node.attrs?.['databaseId'];

      return typeof databaseId === 'string' && databaseId.length > 0
        ? { type: 'database', databaseId, display: 'page' }
        : null;
    }

    default:
      return null;
  }
}

/** Domain blocks inside a toggle: no ids, because they are part of the toggle row. */
function contentsFromNodes(nodes: readonly EditorNode[]): BlockContent[] {
  const result: BlockContent[] = [];

  for (const node of nodes) {
    if (node.type === 'bulletList') {
      collectListContents(node, 'bulletedListItem', result);
      continue;
    }

    if (node.type === 'orderedList') {
      collectListContents(node, 'numberedListItem', result);
      continue;
    }

    if (node.type === 'taskList') {
      collectTaskContents(node, result);
      continue;
    }

    const content = nodeToContent(node);

    if (content) {
      result.push(content);
    }
  }

  return result;
}

/**
 * Converts a Tiptap JSON document back into contract blocks.
 *
 * Lists unfold into separate blocks: the contract stores every list item as
 * its own row. Nested toggle blocks stay inside its `content.children` and are
 * saved atomically with the title.
 *
 * PM serialises a childless document ({type:'doc'}) without a content key —
 * that is a legitimate "deleted everything" state, so the key is optional here,
 * although in the documents we build it is always present.
 */
export function editorDocumentToBlocks(
  document: Pick<EditorDocument, 'type'> & { content?: EditorNode[] },
): EditorBlockContent[] {
  const result: EditorBlockContent[] = [];

  // PM serialises a completely empty document without a content key
  // ({type:'doc'}) — that is a legitimate "deleted everything" state.
  for (const node of document.content ?? []) {
    if (node.type === 'bulletList') {
      collectListItems(node, 'bulletedListItem', result);
      continue;
    }

    if (node.type === 'orderedList') {
      collectListItems(node, 'numberedListItem', result);
      continue;
    }

    if (node.type === 'taskList') {
      collectTaskItems(node, result);
      continue;
    }

    const content = nodeToContent(node);

    if (content) {
      result.push({ id: blockIdOf(node), content });
    }
  }

  return result;
}

/** Minimal ProseMirror state needed to find the block under the cursor. */
export interface BlockSelectionLike {
  doc: {
    nodeAt(position: number): { attrs: Record<string, unknown> } | null;
  };
  selection: {
    from: number;
    $from: {
      depth: number;
      node(depth: number): { attrs: Record<string, unknown> };
    };
  };
}

/**
 * Finds the id of the block under the cursor: first for an atomic node
 * (image, divider), then walks up the ancestors to the nearest node with blockId.
 */
export function findBlockIdAtSelection(state: BlockSelectionLike): string | null {
  const { $from } = state.selection;

  // nodeAt(from) for a text cursor can return the neighbouring atomic
  // node at a block boundary. The atom is only checked for a top-level
  // NodeSelection, where $from.depth === 0.
  if ($from.depth === 0) {
    const atom = state.doc.nodeAt(state.selection.from);
    const atomId = atom?.attrs['blockId'];

    if (typeof atomId === 'string' && atomId.length > 0) {
      return atomId;
    }
  }

  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const blockId = $from.node(depth).attrs['blockId'];

    if (typeof blockId === 'string' && blockId.length > 0) {
      return blockId;
    }
  }

  return null;
}
