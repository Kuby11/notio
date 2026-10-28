import { newId } from '@notio/contracts';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import type { EditorBlockLocation } from './block-insert';
import type { SlashRange } from './slash';

/**
 * Вставка блока-подстраницы: оптимистичный узел без pageId, затем создание
 * страницы сервисом и обновление attrs. Чистые операции над редактором —
 * сеть и навигация приходят через мост из ui/public/editor.tsx.
 */

/** Дочерняя страница, созданная сервисом: id и данные для отображения. */
export interface SubPageDraft {
  id: string;
  title: string;
  icon: string | null;
}

/**
 * Мост к React-слою: расширения не знают про сеть и роутер.
 *
 * Живёт в WeakMap по экземпляру редактора: typing `editor.storage` в Tiptap
 * использует DOM-интерфейс Storage без индексной сигнатуры, поэтому хранить
 * мост в storage без as-приведения нельзя. WeakMap умирает вместе с редактором.
 */
export interface SubPageBridge {
  /** Создаёт дочернюю страницу для текущей; null — создать не удалось. */
  createSubPage: () => Promise<SubPageDraft | null>;
  /** Открывает страницу (навигация на её роут). */
  openSubPage: (pageId: string) => void;
}

const NOOP_BRIDGE: SubPageBridge = {
  createSubPage: async () => null,
  openSubPage: () => undefined,
};

const bridges = new WeakMap<object, SubPageBridge>();

/** Назначает мост редактору — один раз на экземпляр из ui/public/editor.tsx. */
export function setSubPageBridge(editor: object, bridge: SubPageBridge): void {
  bridges.set(editor, bridge);
}

export function subPageBridge(editor: object): SubPageBridge {
  return bridges.get(editor) ?? NOOP_BRIDGE;
}

const LIST_WRAPPER_TYPES = new Set(['bulletList', 'orderedList', 'taskList']);

function createSubPageNode(editor: Editor): ProseMirrorNode | null {
  const type = editor.state.schema.nodes['subPage'];

  // Свой blockId нужен, чтобы найти узел после асинхронного ответа сервиса.
  return type?.create({ blockId: newId() }) ?? null;
}

function insertNodes(
  editor: Editor,
  position: number,
  nodes: ProseMirrorNode[],
  focusTextblock: boolean,
): void {
  const transaction = editor.state.tr.insert(position, nodes);

  if (focusTextblock) {
    const paragraphPosition = position + (nodes[0]?.nodeSize ?? 0) + 1;

    transaction.setSelection(TextSelection.near(transaction.doc.resolve(paragraphPosition)));
  }

  editor.view.dispatch(transaction.scrollIntoView());
  editor.commands.focus();
}

/**
 * Вставляет подстраницу вместо `/page` в текущем блоке.
 *
 * Пустой абзац заменяется узлом-ссылкой, непустой получает её снизу. Из
 * списка команда выходит так же, как заголовок или toggle: иначе атомарный
 * узел оказался бы внутри listItem и потерялся при сериализации.
 */
export async function insertSubPageAtSlash(editor: Editor, range: SlashRange): Promise<boolean> {
  const chain = editor.chain().focus().deleteRange(range);

  if (editor.isActive('taskItem')) {
    chain.liftListItem('taskItem');
  } else if (editor.isActive('listItem')) {
    chain.liftListItem('listItem');
  }

  chain.run();

  const { selection } = editor.state;
  const node = createSubPageNode(editor);
  const paragraph = editor.state.schema.nodes['paragraph'];

  if (!node || !paragraph || selection.$from.depth < 1) {
    return false;
  }

  const $from = selection.$from;

  let depth = $from.depth;

  while (depth > 1 && !$from.node(depth).isTextblock) {
    depth -= 1;
  }

  const textblock = $from.node(depth);
  const parent = $from.node(depth - 1);
  const parentTypeName = parent.type.name;
  const escapesToTopLevel =
    parentTypeName === 'details' ||
    parentTypeName === 'listItem' ||
    parentTypeName === 'taskItem' ||
    depth !== $from.depth;

  if (escapesToTopLevel) {
    // Верхнеуровневый блок под курсором: вставка после него целиком.
    const topLevel = $from.node(1);

    insertNodes(editor, $from.before(1) + topLevel.nodeSize, [node, paragraph.create()], true);
  } else if (textblock.type.name === 'paragraph' && textblock.textContent.length === 0) {
    const start = $from.before(depth);
    const transaction = editor.state.tr.replaceWith(start, $from.after(depth), [
      node,
      paragraph.create(),
    ]);
    const cursor = start + node.nodeSize + 1;

    transaction.setSelection(TextSelection.near(transaction.doc.resolve(cursor)));
    editor.view.dispatch(transaction.scrollIntoView());
    editor.commands.focus();
  } else {
    insertNodes(editor, $from.after(depth), [node, paragraph.create()], true);
  }

  return linkCreatedPage(editor, blockIdOf(node));
}

/** Вставляет подстраницу под блоком из plus-меню. */
export async function insertSubPageBelow(
  editor: Editor,
  source: EditorBlockLocation,
): Promise<boolean> {
  const node = createSubPageNode(editor);
  const paragraph = editor.state.schema.nodes['paragraph'];

  if (!node || !paragraph) {
    return false;
  }

  // Из списка узел выходит наружу — после всего списка.
  const position = LIST_WRAPPER_TYPES.has(source.parent.type.name)
    ? source.parentPos + source.parent.nodeSize
    : source.pos + source.node.nodeSize;

  insertNodes(editor, position, [node, paragraph.create()], true);

  return linkCreatedPage(editor, blockIdOf(node));
}

function blockIdOf(node: ProseMirrorNode): string {
  const blockId = node.attrs['blockId'];

  return typeof blockId === 'string' ? blockId : '';
}

interface NodePosition {
  pos: number;
  node: ProseMirrorNode;
}

function findSubPageByBlockId(editor: Editor, blockId: string): NodePosition | null {
  let found: NodePosition | null = null;

  editor.state.doc.descendants((node, pos) => {
    if (found !== null || node.type.name !== 'subPage') {
      return !found;
    }

    if (blockIdOf(node) === blockId) {
      found = { pos, node };
      return false;
    }

    return true;
  });

  return found;
}

/**
 * Дожидается создания страницы и связывает узел с ней.
 *
 * Узел с пустым pageId не сохраняется, поэтому гонки с автосохранением нет:
 * блок попадёт в БД только после ответа сервиса. Если страницу создать не
 * удалось, заглушка заменяется пустым абзацем. Пользователь мог удалить
 * узел за время запроса — тогда ничего не трогаем.
 */
async function linkCreatedPage(editor: Editor, blockId: string): Promise<boolean> {
  const draft = await subPageBridge(editor).createSubPage();

  if (editor.isDestroyed) {
    return draft !== null;
  }

  const found = blockId.length > 0 ? findSubPageByBlockId(editor, blockId) : null;

  if (!found) {
    return draft !== null;
  }

  if (draft) {
    const transaction = editor.state.tr.setNodeMarkup(found.pos, undefined, {
      ...found.node.attrs,
      pageId: draft.id,
      title: draft.title,
      icon: draft.icon,
    });

    editor.view.dispatch(transaction);
    return true;
  }

  const paragraph = editor.state.schema.nodes['paragraph'];

  if (!paragraph) {
    return false;
  }

  // Если следом уже стоит пустой абзац (его добавила вставка для набора
  // текста), заглушку просто удаляем — документ возвращается к одному блоку.
  const next = editor.state.doc.resolve(found.pos + found.node.nodeSize).nodeAfter;
  const nextIsEmptyParagraph = next?.type.name === 'paragraph' && next.textContent.length === 0;
  const transaction = nextIsEmptyParagraph
    ? editor.state.tr.delete(found.pos, found.pos + found.node.nodeSize)
    : editor.state.tr.replaceWith(found.pos, found.pos + found.node.nodeSize, paragraph.create());

  transaction.setSelection(TextSelection.near(transaction.doc.resolve(found.pos)));
  editor.view.dispatch(transaction.scrollIntoView());

  return false;
}
