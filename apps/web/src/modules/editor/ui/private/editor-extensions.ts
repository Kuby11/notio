import {
  Extension,
  InputRule,
  Node,
  ReactNodeViewRenderer,
  mergeAttributes,
  textblockTypeInputRule,
} from '@tiptap/react';
import { ListItem } from '@tiptap/extension-list';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { StarterKit } from '@tiptap/starter-kit';
import { ToDoNodeView } from './to-do-node-view';
import { replaceTextblockWithToggle } from './toggle-command';
import { ToggleNodeView } from './toggle-node-view';

/** Общий парсер/рендерер data-атрибута с id блока. */
const blockIdAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute('data-block-id'),
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes['blockId'] ? { 'data-block-id': attributes['blockId'] } : {},
};

/**
 * id блока на стандартных узлах Tiptap (параграф, заголовок, listItem и т.д.).
 * Без него после гидратации нельзя понять, какую строку БД обновлять.
 */
const BlockIdAttribute = Extension.create({
  name: 'blockIdAttribute',
  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'blockquote', 'codeBlock', 'horizontalRule', 'listItem'],
        attributes: {
          blockId: blockIdAttribute,
        },
      },
    ];
  },
});

/**
 * Стандартная схема listItem с кастомным DOM.
 *
 * Списки остаются нативными для ProseMirror (Enter/Backspace/вложенность
 * работают из коробки), но получают Notion-подобный non-editable маркер.
 * Символ и номер рисует CSS, поэтому маркер не участвует в тексте блока.
 */
const ListItemBlock = ListItem.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(HTMLAttributes, { class: 'notion-list-item' }),
      [
        'span',
        {
          'data-list-marker': '',
          'aria-hidden': 'true',
          contenteditable: 'false',
          class: 'notion-list-marker',
        },
        '',
      ],
      ['div', { class: 'notion-list-content' }, 0],
    ];
  },
});

/** Изображение показывается заглушкой: media-service появится на этапе 6. */
const ImageBlock = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      fileId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-file-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['fileId'] ? { 'data-file-id': attributes['fileId'] } : {},
      },
      caption: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-caption'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['caption'] ? { 'data-caption': attributes['caption'] } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-block-type="image"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const caption = typeof node.attrs['caption'] === 'string' ? node.attrs['caption'] : '';

    return [
      'figure',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'image',
        class: 'my-2 rounded border border-neutral-200 p-3 text-sm text-neutral-500',
      }),
      ['span', { 'aria-hidden': 'true' }, '🖼'],
      ['figcaption', { class: 'mt-1 text-xs' }, caption || 'Изображение'],
    ];
  },
});

/** To-do хранит отметку в attrs; чекбокс и зачёркивание рендерит React-компонент. */
const ToDoBlock = Node.create({
  name: 'toDo',
  group: 'block',
  content: 'inline*',
  defining: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      checked: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-checked') === 'true',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-checked': attributes['checked'] ? 'true' : 'false',
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="to-do"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const checked = node.attrs['checked'] === true;

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'to-do',
        class: 'flex items-start gap-2',
      }),
      ['span', { class: 'select-none', 'aria-hidden': 'true' }, checked ? '☑' : '☐'],
      ['span', { class: checked ? 'flex-1 text-muted-foreground line-through' : 'flex-1' }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToDoNodeView);
  },
  addInputRules() {
    return [textblockTypeInputRule({ find: /^\[\]\s$/u, type: this.type })];
  },
});

/**
 * Toggle — контейнер: первый абзац является заголовком, остальные блоки —
 * раскрывающимся телом. React-компонент рисует стрелку и прячет тело при
 * `open: false`.
 */
const ToggleBlock = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'paragraph block*',
  defining: true,
  // Выше blockquote: иначе встроенное правило `> ` превратит строку в цитату,
  // а в Notion этот триггер означает toggle-список.
  priority: 101,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      open: {
        default: true,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-open') !== 'false',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-open': attributes['open'] === false ? 'false' : 'true',
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="toggle"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'toggle',
        class: 'notion-toggle',
      }),
      ['div', { class: 'notion-toggle-content' }, 0],
    ];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ToggleNodeView);
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^>\s$/u,
        handler: ({ state, range }) => {
          const transaction = state.tr.delete(range.from, range.to);

          replaceTextblockWithToggle(transaction, range.from);
        },
      }),
    ];
  },
});

/**
 * Ищет первый пустой textblock — нужен для пустой страницы с AllSelection.
 */
function findFirstEmptyTextblock(doc: ProseMirrorNode): { from: number; size: number } | null {
  let result: { from: number; size: number } | null = null;

  doc.descendants((child, position) => {
    if (result) {
      return false;
    }

    if (child.type.isTextblock && child.type.name !== 'codeBlock' && child.content.size === 0) {
      result = { from: position, size: child.nodeSize };
      return false;
    }

    return true;
  });

  return result;
}

/**
 * Подсказка в текущем пустом блоке.
 *
 * Встроенный Placeholder при showOnlyCurrent смотрит только на top-level
 * узел. В списке курсор находится в paragraph внутри listItem, поэтому
 * встроенное расширение там подсказку не показывало. Здесь decoration
 * вешается на непосредственный textblock под курсором.
 */
const PlaceholderHint = Extension.create({
  name: 'placeholderHint',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: ({ doc, selection }) => {
            const isEmptyDocument = doc.textBetween(0, doc.content.size, '\n', '\n').length === 0;
            const isAllSelected =
              selection.from === 0 && selection.to === doc.content.size && isEmptyDocument;

            if (!selection.empty && !isAllSelected) {
              return null;
            }

            let from: number;
            let nodeSize: number;

            if (selection.empty) {
              const { $from } = selection;
              const node = $from.depth > 0 ? $from.parent : $from.nodeAfter;

              if (
                !node ||
                !node.type.isTextblock ||
                node.type.name === 'codeBlock' ||
                node.content.size > 0
              ) {
                return null;
              }

              from = $from.depth > 0 ? $from.before() : $from.pos;
              nodeSize = node.nodeSize;
            } else {
              // На пустой странице Tiptap может держать AllSelection
              // (from 0 до конца документа). Подсказка всё равно нужна.
              const firstEmptyBlock = findFirstEmptyTextblock(doc);

              if (!firstEmptyBlock) {
                return null;
              }

              from = firstEmptyBlock.from;
              nodeSize = firstEmptyBlock.size;
            }

            return DecorationSet.create(doc, [
              Decoration.node(from, from + nodeSize, {
                class: 'is-empty',
                'data-placeholder': 'Press / for commands',
              }),
            ]);
          },
        },
      }),
    ];
  },
});

/**
 * Набор расширений редактора.
 *
 * Mark-расширения (bold/italic/...) отключены: BlockContent сейчас хранит
 * плоский текст, и молча терять форматирование при сохранении нельзя.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    bold: false,
    italic: false,
    strike: false,
    code: false,
    underline: false,
    link: false,
    trailingNode: false,
    listItem: false,
  }),
  ListItemBlock,
  BlockIdAttribute,
  ImageBlock,
  ToDoBlock,
  ToggleBlock,
  PlaceholderHint,
];
