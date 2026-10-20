import { Extension, Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/react';
import { Placeholder } from '@tiptap/extension-placeholder';
import { StarterKit } from '@tiptap/starter-kit';

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

/** To-do хранит отметку в attrs; интерактивный чекбокс добавим вместе с toolbar. */
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
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'to-do',
        class: 'flex items-start gap-2',
      }),
      ['span', { class: 'select-none', 'aria-hidden': 'true' }, node.attrs['checked'] ? '☑' : '☐'],
      ['span', { class: 'flex-1' }, 0],
    ];
  },
  addInputRules() {
    return [textblockTypeInputRule({ find: /^\[\]\s$/u, type: this.type })];
  },
});

/** Toggle пока хранит только текст: вложенные блоки появятся позже. */
const ToggleBlock = Node.create({
  name: 'toggle',
  group: 'block',
  content: 'inline*',
  defining: true,
  // Выше blockquote: иначе встроенное правило `> ` превратит строку в цитату,
  // а в Notion этот триггер означает toggle-список.
  priority: 101,
  addAttributes() {
    return { blockId: blockIdAttribute };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="toggle"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'toggle',
        class: 'flex items-start gap-2',
      }),
      ['span', { class: 'select-none', 'aria-hidden': 'true' }, '▸'],
      ['span', { class: 'flex-1' }, 0],
    ];
  },
  addInputRules() {
    return [textblockTypeInputRule({ find: /^>\s$/u, type: this.type })];
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
  }),
  BlockIdAttribute,
  ImageBlock,
  ToDoBlock,
  ToggleBlock,
  Placeholder.configure({ placeholder: 'Начните писать или введите / для команд…' }),
];
