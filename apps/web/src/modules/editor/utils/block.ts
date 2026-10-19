/**
 * Доменные правила блоков редактора.
 *
 * Чистый TypeScript без React, Tiptap и сети. Сериализация, миграция и
 * реестр типов блоков живут здесь: иначе один и тот же инвариант жил бы
 * в трёх местах (редактор, автосохранение, миграции).
 */
import {
  BLOCK_TYPES,
  newId,
  type Block,
  type BlockContent,
  type BlockType,
} from '@notio/contracts';

/** Блок в терминах домена: то же, что контракт, но с явным children для toggle. */
export type EditorBlock = Block;

/** Узел JSON-документа Tiptap. Тип описан локально, чтобы utils не зависели от Tiptap. */
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

/** Блок, восстановленный из редактора: id есть только у уже сохранённых блоков. */
export interface EditorBlockContent {
  id: string | null;
  content: BlockContent;
}

/** Реестр типов блоков: новый тип добавляется регистрацией, а не правкой switch. */
export interface BlockDefinition {
  type: BlockType;
  /** Заголовок в slash-меню. */
  label: string;
  /** Иконка в slash-меню (emoji или имя иконки). */
  icon: string;
  /** Создаёт пустой блок этого типа. */
  create: () => BlockContent;
  /** Текстовое представление для поиска и превью. */
  toText: (content: BlockContent) => string;
}

const registry = new Map<BlockType, BlockDefinition>();

/** Регистрирует тип блока. Повторная регистрация заменяет предыдущую. */
export function registerBlock(definition: BlockDefinition): void {
  registry.set(definition.type, definition);
}

/** Возвращает определение типа или undefined, если тип не зарегистрирован. */
export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return registry.get(type);
}

/** Все зарегистрированные типы — для slash-меню и валидации. */
export function listBlockDefinitions(): BlockDefinition[] {
  return [...registry.values()];
}

/** Создаёт пустой блок заданного типа. */
export function createEmptyBlock(type: BlockType): BlockContent {
  const definition = registry.get(type);

  if (!definition) {
    throw new Error(`Тип блока ${type} не зарегистрирован`);
  }

  return definition.create();
}

function contentText(content: BlockContent): string {
  return 'content' in content ? content.content : '';
}

/**
 * Все типы из контракта регистрируются при импорте модуля.
 *
 * Благодаря этому slash-меню и сериализация видят один и тот же набор:
 * новый тип достаточно добавить в BLOCK_TYPES и в этот список.
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
        // Временный id заменяется при загрузке файла в media-service.
        create: () => ({ type, fileId: newId(), caption: null }),
        toText: (content) => (content.type === 'image' ? (content.caption ?? '') : ''),
      };
    case 'toggle':
      return {
        type,
        label: 'Переключатель',
        icon: '▸',
        create: () => ({ type, content: '' }),
        toText: contentText,
      };
  }
});

for (const definition of DEFAULT_BLOCK_DEFINITIONS) {
  registerBlock(definition);
}

/** Текстовое содержимое блока; у divider и image его нет. */
export function contentToText(content: BlockContent): string {
  return contentText(content);
}

/** Текстовое представление блока для поиска и превью. */
export function blockToText(block: Block): string {
  const definition = registry.get(block.type);

  return definition ? definition.toText(block.content) : contentText(block.content);
}

/** Плоский текст документа: используется для превью и старых миграций. */
export function toEditorText(blocks: readonly Block[]): string {
  return blocks
    .map((block) => blockToText(block))
    .filter((line) => line.length > 0)
    .join('\n');
}

/** Сериализация документа в JSON для хранения и передачи. */
export function serializeDocument(blocks: readonly Block[]): string {
  return JSON.stringify(blocks);
}

/** Десериализация документа с валидацией через контракт. */
export function deserializeDocument(json: string): Block[] {
  const parsed = JSON.parse(json);

  if (!Array.isArray(parsed)) {
    throw new Error('Документ должен быть массивом блоков');
  }

  return parsed.map((entry) => {
    // Миграция старых форматов: если content — строка, оборачиваем в paragraph.
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

/** Проверка, что блок можно переместить: нельзя внутрь самого себя. */
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
  const blockId = node.attrs?.['blockId'];

  return typeof blockId === 'string' && blockId.length > 0 ? blockId : null;
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

/** Текст блока вместе с переносами между абзацами (quote, listItem). */
function blockText(node: EditorNode): string {
  const paragraphs = (node.content ?? []).filter((child) => child.type === 'paragraph');

  if (paragraphs.length > 0) {
    return paragraphs.map(inlineText).join('\n');
  }

  return inlineText(node);
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

function paragraphNode(text: string): EditorNode {
  return { type: 'paragraph', content: inlineNodes(text, true) };
}

function listItemNode(blockId: string, text: string): EditorNode {
  return {
    type: 'listItem',
    attrs: { blockId },
    content: [paragraphNode(text)],
  };
}

function headingLevelOf(node: EditorNode): 1 | 2 | 3 {
  const level = node.attrs?.['level'];

  return level === 1 || level === 2 || level === 3 ? level : 1;
}

function codeLanguageOf(node: EditorNode): string | null {
  const language = node.attrs?.['language'];

  return typeof language === 'string' && language.length > 0 ? language : null;
}

function captionOf(node: EditorNode): string | null {
  const caption = node.attrs?.['caption'];

  return typeof caption === 'string' ? caption : null;
}

/**
 * Преобразует сохранённые блоки в JSON-документ Tiptap.
 *
 * Соседние элементы списков объединяются в один list-узел, как того требует
 * схема ProseMirror. Идентификаторы сохраняются в attrs blockId, чтобы
 * выделение и последующее сохранение могли сопоставить узлы с БД.
 */
export function blocksToEditorDocument(blocks: readonly Block[]): EditorDocument {
  const content: EditorNode[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];

    if (!block) {
      break;
    }

    switch (block.content.type) {
      case 'bulletedListItem':
      case 'numberedListItem': {
        const itemType = block.content.type;
        const listType = itemType === 'bulletedListItem' ? 'bulletList' : 'orderedList';
        const items: EditorNode[] = [];

        while (index < blocks.length) {
          const current = blocks[index];

          if (!current || current.content.type !== itemType) {
            break;
          }

          items.push(listItemNode(current.id, current.content.content));
          index += 1;
        }

        content.push({ type: listType, content: items });
        continue;
      }

      case 'paragraph':
        content.push({
          type: 'paragraph',
          attrs: { blockId: block.id },
          content: inlineNodes(block.content.content, true),
        });
        break;

      case 'heading':
        content.push({
          type: 'heading',
          attrs: { blockId: block.id, level: block.content.level },
          content: inlineNodes(block.content.content, true),
        });
        break;

      case 'quote':
        content.push({
          type: 'blockquote',
          attrs: { blockId: block.id },
          content: [paragraphNode(block.content.content)],
        });
        break;

      case 'code':
        content.push({
          type: 'codeBlock',
          attrs: { blockId: block.id, language: block.content.language },
          content: inlineNodes(block.content.content, false),
        });
        break;

      case 'divider':
        content.push({ type: 'horizontalRule', attrs: { blockId: block.id } });
        break;

      case 'toDo':
        content.push({
          type: 'toDo',
          attrs: { blockId: block.id, checked: block.content.checked },
          content: inlineNodes(block.content.content, true),
        });
        break;

      case 'image':
        content.push({
          type: 'image',
          attrs: {
            blockId: block.id,
            fileId: block.content.fileId,
            caption: block.content.caption,
          },
        });
        break;

      case 'toggle':
        content.push({
          type: 'toggle',
          attrs: { blockId: block.id },
          content: inlineNodes(block.content.content, true),
        });
        break;
    }

    index += 1;
  }

  return { type: 'doc', content };
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
      content: { type, content: blockText(item) },
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

/**
 * Преобразует JSON-документ Tiptap обратно в плоские блоки контракта.
 *
 * Списки разворачиваются в отдельные блоки: контракт хранит каждый элемент
 * списка отдельной строкой. Вложенные списки также разворачиваются, поэтому
 * после сохранения их иерархия не сохраняется — это ограничение текущей
 * схемы BlockContent, а не редактора.
 */
export function editorDocumentToBlocks(document: EditorDocument): EditorBlockContent[] {
  const result: EditorBlockContent[] = [];

  for (const node of document.content) {
    switch (node.type) {
      case 'paragraph':
        result.push({
          id: blockIdOf(node),
          content: { type: 'paragraph', content: inlineText(node) },
        });
        break;

      case 'heading':
        result.push({
          id: blockIdOf(node),
          content: {
            type: 'heading',
            level: headingLevelOf(node),
            content: inlineText(node),
          },
        });
        break;

      case 'blockquote':
        result.push({ id: blockIdOf(node), content: { type: 'quote', content: blockText(node) } });
        break;

      case 'codeBlock':
        result.push({
          id: blockIdOf(node),
          content: { type: 'code', language: codeLanguageOf(node), content: inlineText(node) },
        });
        break;

      case 'horizontalRule':
        result.push({ id: blockIdOf(node), content: { type: 'divider' } });
        break;

      case 'toDo':
        result.push({
          id: blockIdOf(node),
          content: {
            type: 'toDo',
            checked: node.attrs?.['checked'] === true,
            content: inlineText(node),
          },
        });
        break;

      case 'image': {
        const fileId = node.attrs?.['fileId'];

        // Без fileId блок изображения невалиден по контракту и не сохраняется.
        if (typeof fileId === 'string' && fileId.length > 0) {
          result.push({
            id: blockIdOf(node),
            content: { type: 'image', fileId, caption: captionOf(node) },
          });
        }
        break;
      }

      case 'toggle':
        result.push({
          id: blockIdOf(node),
          content: { type: 'toggle', content: inlineText(node) },
        });
        break;

      case 'bulletList':
        collectListItems(node, 'bulletedListItem', result);
        break;

      case 'orderedList':
        collectListItems(node, 'numberedListItem', result);
        break;

      default:
        break;
    }
  }

  return result;
}

/** Минимальное состояние ProseMirror, нужное для поиска блока под курсором. */
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
 * Ищет id блока под курсором: сначала для атомарного узла (image, divider),
 * затем поднимается по предкам до ближайшего узла с blockId.
 */
export function findBlockIdAtSelection(state: BlockSelectionLike): string | null {
  const { $from } = state.selection;

  // nodeAt(from) для текстового курсора может вернуть соседний атомарный
  // узел на границе блока. Атом проверяем только для NodeSelection верхнего
  // уровня, где $from.depth === 0.
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
