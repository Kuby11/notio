import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';

const UI_TASK_TEXTS: Record<string, [string, string]> = {
  ru: ['Снять отметку', 'Отметить задачу'],
  en: ['Uncheck', 'Check'],
};

export function uiTaskLabel(checked: boolean): string {
  const lang = document.documentElement.lang === 'ru' ? 'ru' : 'en';

  return UI_TASK_TEXTS[lang]![checked ? 0 : 1]!;
}

const UI_TOGGLE_TEXTS: Record<string, [string, string]> = {
  ru: ['Свернуть переключатель', 'Развернуть переключатель'],
  en: ['Collapse toggle', 'Expand toggle'],
};

export function uiToggleLabel(expand: boolean): string {
  const lang = document.documentElement.lang === 'ru' ? 'ru' : 'en';

  return UI_TOGGLE_TEXTS[lang]![expand ? 1 : 0]!;
}

/** Text in renderHTML outside React: the locale is read from <html lang>. */
const UI_TEXTS: Record<string, Record<string, string>> = {
  ru: {
    page: 'Страница',
    pickPage: 'Выбрать страницу…',
    breadcrumb: 'Хлебные крошки документа',
    database: 'База данных',
    untitled: 'Без названия',
    creatingPage: 'Создание страницы…',
    image: 'Изображение',
    video: 'Видео',
    file: 'Файл',
    downloadName: 'Файл',
  },
  en: {
    page: 'Page',
    pickPage: 'Pick a page…',
    breadcrumb: 'Document breadcrumbs',
    database: 'Database',
    untitled: 'Untitled',
    creatingPage: 'Creating page…',
    image: 'Image',
    video: 'Video',
    file: 'File',
    downloadName: 'File',
  },
};

export function uiText(key: string): string {
  const lang = document.documentElement.lang === 'ru' ? 'ru' : 'en';

  return UI_TEXTS[lang]![key]!;
}

/** Hint in the current empty block: the locale is read from <html lang>. */
const PLACEHOLDER_TEXTS: Record<string, string> = {
  ru: 'Нажмите / для команд',
  en: 'Press / for commands',
};

export function placeholderText(): string {
  return PLACEHOLDER_TEXTS[document.documentElement.lang] ?? PLACEHOLDER_TEXTS['en']!;
}

/** Whether a textblock is empty: no text and no atoms like hardBreak. */
function isTextblockEmpty(node: ProseMirrorNode): boolean {
  let empty = true;

  node.forEach((child) => {
    if (!empty) {
      return;
    }

    if (child.isText) {
      empty = (child.text ?? '').length === 0;
      return;
    }

    if (child.isLeaf || child.isAtom) {
      empty = false;
      return;
    }

    empty = isTextblockEmpty(child);
  });

  return empty;
}

/**
 * Placeholder only in the block under the cursor, including blocks nested in
 * lists, tasks and toggles.
 *
 * The official Placeholder with `includeChildren: true` keeps decorations in a
 * state field and recomputes them only for changed ranges. Moving between empty
 * blocks leaves the previous block's decoration in place, so the hint sticks.
 * Here decorations are recomputed from scratch on every render from the
 * cursor's ancestors — a cheap pass without state.
 */
export const BlockPlaceholder = Extension.create({
  name: 'blockPlaceholder',
  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          decorations: (state) => {
            if (!editor.isEditable) {
              return null;
            }

            const { $from } = state.selection;

            for (let depth = $from.depth; depth > 0; depth -= 1) {
              const node = $from.node(depth);

              if (!node.type.isTextblock) {
                continue;
              }

              if (!isTextblockEmpty(node)) {
                return null;
              }

              const position = $from.before(depth);

              return DecorationSet.create(state.doc, [
                Decoration.node(position, position + node.nodeSize, {
                  class: 'is-empty',
                  'data-placeholder': placeholderText(),
                }),
              ]);
            }

            return null;
          },
        },
      }),
    ];
  },
});

/** Highlight class of the block the dragged block will align to. */
