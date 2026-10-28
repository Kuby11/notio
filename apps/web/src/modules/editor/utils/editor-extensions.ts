import { newId } from '@notio/contracts';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import type { ComponentType } from 'react';
import {
  Extension,
  InputRule,
  Mark,
  Node,
  ReactNodeViewRenderer,
  mergeAttributes,
  type ReactNodeViewProps,
} from '@tiptap/react';
import { Details, DetailsContent, DetailsSummary } from '@tiptap/extension-details';
import { ListItem, TaskItem, TaskList } from '@tiptap/extension-list';
import type { DOMOutputSpec, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { NodeSelection, Plugin } from '@tiptap/pm/state';
import { cellAround } from '@tiptap/pm/tables';
import { dropPoint } from '@tiptap/pm/transform';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { StarterKit } from '@tiptap/starter-kit';
import { SlashMenuExtension } from '../ui/private/slash-menu-extension';
import { EmojiView, FileView, ImageView, VideoView } from '../ui/private/media-views';
import { EquationBlockView, InlineMathView } from '../ui/private/equation-views';
import { BreadcrumbView, ColumnsColumnView, PageLinkView } from '../ui/private/structure-views';
import { subPageBridge } from './sub-page';
import { replaceTextblockWithDetails } from './toggle-command';

/** Shared parser/renderer of the data attribute carrying the block id. */
const blockIdAttribute = {
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute('data-block-id'),
  renderHTML: (attributes: Record<string, unknown>) =>
    attributes['blockId'] ? { 'data-block-id': attributes['blockId'] } : {},
};

/** Factory of the colour preset data attribute (data-color / data-background-color). */
function colorDataAttribute(name: 'color' | 'backgroundColor') {
  const dataName = name === 'color' ? 'data-color' : 'data-background-color';

  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(dataName),
    renderHTML: (attributes: Record<string, unknown>) =>
      attributes[name] ? { [dataName]: attributes[name] } : {},
  };
}

/** Text and background colours live in block content (see ADR 0017). */
const COLORABLE_NODE_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'listItem',
  'taskItem',
  'details',
  'table',
] as const;

/**
 * Block id on standard Tiptap nodes (paragraph, heading, listItem and so on).
 * Without it, after hydration it is impossible to tell which database row to update.
 */
const BlockIdAttribute = Extension.create({
  name: 'blockIdAttribute',
  addGlobalAttributes() {
    return [
      {
        types: [
          'paragraph',
          'heading',
          'blockquote',
          'codeBlock',
          'horizontalRule',
          'listItem',
          'taskItem',
          'details',
          'table',
        ],
        attributes: {
          blockId: blockIdAttribute,
        },
      },
      {
        types: [...COLORABLE_NODE_TYPES],
        attributes: {
          color: colorDataAttribute('color'),
          backgroundColor: colorDataAttribute('backgroundColor'),
        },
      },
    ];
  },
});

/**
 * Nodes that map to a separate `blocks` row.
 *
 * Blocks nested in a toggle live inside its content, so only top-level nodes
 * and list items receive ids. A table is one row: its rows and cells
 * serialise into its content.
 */
const BLOCK_ROW_TYPES = new Set([
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'horizontalRule',
  'image',
  'video',
  'file',
  'emoji',
  'details',
  'table',
  'subPage',
  'columnsList',
  'equationBlock',
  'pageLink',
  'breadcrumbBlock',
]);

function ownsBlockRow(typeName: string, parentTypeName: string | null): boolean {
  if (typeName === 'listItem' || typeName === 'taskItem') {
    return true;
  }

  return parentTypeName === 'doc' && BLOCK_ROW_TYPES.has(typeName);
}

/**
 * Hands out ids to new blocks before autosave.
 *
 * Autosave compares editor nodes with database blocks by blockId. Enter/insert
 * create nodes without ids, and splitting a block copies attrs — the second
 * node would get someone else's id. The plugin assigns missing and duplicate
 * ids in a single transaction, so the diff is always unambiguous.
 */
const BlockIdGuard = Extension.create({
  name: 'blockIdGuard',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) {
            return null;
          }

          const seen = new Set<string>();
          const transaction = newState.tr;
          let assigned = false;

          newState.doc.descendants((node, position, parent) => {
            if (!ownsBlockRow(node.type.name, parent?.type.name ?? null)) {
              return;
            }

            const blockId = node.attrs['blockId'];
            const hasUniqueId =
              typeof blockId === 'string' && blockId.length > 0 && !seen.has(blockId);

            if (hasUniqueId) {
              seen.add(blockId);
              return;
            }

            const nextBlockId = newId();
            seen.add(nextBlockId);
            transaction.setNodeMarkup(position, undefined, {
              ...node.attrs,
              blockId: nextBlockId,
            });
            assigned = true;
          });

          if (!assigned) {
            return null;
          }

          // Ids are service markup, not an undo history step.
          transaction.setMeta('addToHistory', false);

          return transaction;
        },
      }),
    ];
  },
});

const UI_TASK_TEXTS: Record<string, [string, string]> = {
  ru: ['Снять отметку', 'Отметить задачу'],
  en: ['Uncheck', 'Check'],
};

function uiTaskLabel(checked: boolean): string {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';

  return UI_TASK_TEXTS[lang]![checked ? 0 : 1]!;
}

const UI_TOGGLE_TEXTS: Record<string, [string, string]> = {
  ru: ['Свернуть переключатель', 'Развернуть переключатель'],
  en: ['Collapse toggle', 'Expand toggle'],
};

function uiToggleLabel(expand: boolean): string {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';

  return UI_TOGGLE_TEXTS[lang]![expand ? 1 : 0]!;
}

/** Text in renderHTML outside React: the locale is read from <html lang>. */
const UI_TEXTS: Record<string, Record<string, string>> = {
  ru: {
    page: 'Страница',
    pickPage: 'Выбрать страницу…',
    breadcrumb: 'Хлебные крошки документа',
  },
  en: {
    page: 'Page',
    pickPage: 'Pick a page…',
    breadcrumb: 'Document breadcrumbs',
  },
};

function uiText(key: string): string {
  const lang = document.documentElement.lang === 'en' ? 'en' : 'ru';

  return UI_TEXTS[lang]![key]!;
}

/** Hint in the current empty block: the locale is read from <html lang>. */
const PLACEHOLDER_TEXTS: Record<string, string> = {
  ru: 'Нажмите / для команд',
  en: 'Press / for commands',
};

function placeholderText(): string {
  return PLACEHOLDER_TEXTS[document.documentElement.lang] ?? PLACEHOLDER_TEXTS['ru']!;
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
const BlockPlaceholder = Extension.create({
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
const DROP_TARGET_CLASS = 'notio-drop-target';

/**
 * The nearest container with nested blocks (toggle) around a position.
 *
 * Returns the position of the container itself: the highlight goes on its DOM,
 * so the children are marked together with the title.
 */
function nestedBlockPosition(doc: ProseMirrorNode, position: number): number | null {
  const $position = doc.resolve(position);

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    if ($position.node(depth).type.name === 'details') {
      return $position.before(depth);
    }
  }

  return null;
}

/**
 * The position the dragged block aligns to.
 *
 * Computed the same way as the drop cursor line: the point under the cursor,
 * adjusted by `dropPoint` for the dragged fragment.
 */
function dropTargetPosition(view: EditorView, event: DragEvent): number | null {
  const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });

  if (coords === null) {
    return null;
  }

  const slice = view.dragging?.slice;

  if (slice === undefined) {
    return coords.pos;
  }

  return dropPoint(view.state.doc, coords.pos, slice) ?? coords.pos;
}

/**
 * Highlights the container with nested children that the drag aligns into.
 *
 * When dragging into a toggle the thin drop cursor line gets lost among the
 * child blocks, so hitting inside highlights the toggle itself.
 */
const DropTargetHighlight = Extension.create({
  name: 'dropTargetHighlight',
  addProseMirrorPlugins() {
    let highlighted: HTMLElement | null = null;

    const clear = () => {
      highlighted?.classList.remove(DROP_TARGET_CLASS);
      highlighted = null;
    };

    const highlight = (view: EditorView, event: DragEvent) => {
      if (!view.editable) {
        return;
      }

      const target = dropTargetPosition(view, event);
      const position = target === null ? null : nestedBlockPosition(view.state.doc, target);
      const element = position === null ? null : view.nodeDOM(position);

      if (element === highlighted) {
        return;
      }

      clear();

      if (element instanceof HTMLElement) {
        element.classList.add(DROP_TARGET_CLASS);
        highlighted = element;
      }
    };

    return [
      new Plugin({
        view: () => {
          // The drop and the end of the drag happen outside editor.dom (the handle
          // lives in a separate wrapper), so we listen on the document.
          document.addEventListener('dragend', clear);
          document.addEventListener('drop', clear);

          return {
            destroy() {
              clear();
              document.removeEventListener('dragend', clear);
              document.removeEventListener('drop', clear);
            },
          };
        },
        props: {
          handleDOMEvents: {
            dragover: (view, event) => {
              highlight(view, event);
              return false;
            },
            dragleave: (view, event) => {
              const related = event.relatedTarget;

              if (!(related instanceof Element) || !view.dom.contains(related)) {
                clear();
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});

/**
 * Standard listItem schema with custom DOM.
 *
 * Lists stay native to ProseMirror (Enter/Backspace/nesting work out of the
 * box) but get a Notion-like non-editable marker. CSS draws the symbol and the
 * number, so the marker never participates in the block's text.
 */
const ListItemBlock = ListItem.extend({
  renderHTML({ HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(HTMLAttributes, { class: 'notio-list-item' }),
      [
        'span',
        {
          'data-list-marker': '',
          'aria-hidden': 'true',
          contenteditable: 'false',
          class: 'notio-list-marker',
        },
        '',
      ],
      ['div', { class: 'notio-list-content' }, 0],
    ];
  },
});

/**
 * React node view with an editable wrapper.
 *
 * PM sets contenteditable=false on contentless atomic node views, which makes
 * the browser's caret logic skip the area entirely and always return a position
 * AFTER the block: DragHandle cannot find an atomic media block (and with a
 * neighbour would aim at it instead). An attribute set before PM's check (it
 * respects an existing one) keeps the caret inside the wrapper — the left half
 * of the block gives "before", the right half "after".
 */
function editableReactNodeView(component: ComponentType<ReactNodeViewProps>) {
  return (props: Parameters<ReturnType<typeof ReactNodeViewRenderer>>[0]) => {
    const view = ReactNodeViewRenderer(component)(props);

    view.dom.setAttribute('contenteditable', 'true');

    return view;
  };
}

/**
 * Text and background colour marks: the value is a named preset from the
 * contract, the render is a data attribute (palette and dark theme live in
 * CSS, see ADR 0017). The official Color/BackgroundColor write an arbitrary
 * hex into style and do not play well with presets or themes.
 */
function colorMark(name: 'textColor' | 'textBg', dataName: string) {
  return Mark.create({
    name,
    inclusive: false,
    addAttributes() {
      return {
        color: {
          default: null,
          parseHTML: (element: HTMLElement) => element.getAttribute(dataName),
          renderHTML: (attributes: Record<string, unknown>) =>
            attributes['color'] ? { [dataName]: String(attributes['color']) } : {},
        },
      };
    },
    parseHTML() {
      return [{ tag: `span[${dataName}]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ['span', mergeAttributes(HTMLAttributes), 0];
    },
  });
}

const TextColorMark = colorMark('textColor', 'data-text-color');
const TextBackgroundMark = colorMark('textBg', 'data-text-bg');

/** Media node data attribute: fileId, url, caption, name, sizeBytes, emoji. */
function mediaDataAttribute(dataName: string) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute(dataName),
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes[dataName];

      return value === null || value === undefined || value === ''
        ? {}
        : { [dataName]: String(value) };
    },
  };
}

/**
 * Image: a file in R2 (fileId) or an external link (url).
 * Upload and rendering are handled by the React node view
 * (ui/private/media-views); renderHTML stays as the fallback for contexts
 * without a node view.
 */
const ImageBlock = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      fileId: mediaDataAttribute('data-file-id'),
      url: mediaDataAttribute('data-url'),
      caption: mediaDataAttribute('data-caption'),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-width');

          return value === null ? null : Number.parseInt(value, 10);
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['width'] === 'number'
            ? { 'data-width': String(attributes['width']) }
            : {},
      },
      fullWidth: {
        default: false,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-full-width') === 'true',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['fullWidth'] === true ? { 'data-full-width': 'true' } : {},
      },
      // Service flag "source replacement in progress": not serialised, switches on
      // the upload card over an existing block (the "Replace" action).
      replacing: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-block-type="image"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return mediaFigureHTML('image', node, HTMLAttributes, 'Изображение');
  },
  addNodeView() {
    return editableReactNodeView(ImageView);
  },
});

/** Video: like image, but with a player and a 50 MB limit. */
const VideoBlock = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      fileId: mediaDataAttribute('data-file-id'),
      url: mediaDataAttribute('data-url'),
      caption: mediaDataAttribute('data-caption'),
    };
  },
  parseHTML() {
    return [{ tag: 'figure[data-block-type="video"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return mediaFigureHTML('video', node, HTMLAttributes, 'Видео');
  },
  addNodeView() {
    return editableReactNodeView(VideoView);
  },
});

/** File: a row with name, size and download. */
const FileBlock = Node.create({
  name: 'file',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      fileId: mediaDataAttribute('data-file-id'),
      url: mediaDataAttribute('data-url'),
      name: {
        default: 'Файл',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-name') ?? 'Файл',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['name'] ? { 'data-name': String(attributes['name']) } : {},
      },
      sizeBytes: mediaDataAttribute('data-size-bytes'),
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="file"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const name = typeof node.attrs['name'] === 'string' ? node.attrs['name'] : 'Файл';

    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'file', class: 'notio-file' }),
      ['span', { 'aria-hidden': 'true' }, '📎'],
      ['span', { class: 'notio-file-name' }, name],
    ];
  },
  addNodeView() {
    return editableReactNodeView(FileView);
  },
});

/** Emoji block: one large character, changed through a picker. */
const EmojiBlock = Node.create({
  name: 'emoji',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      emoji: {
        default: '⭐',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-emoji') ?? '⭐',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['emoji'] ? { 'data-emoji': String(attributes['emoji']) } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="emoji"]' }];
  },
  renderHTML({ HTMLAttributes, node }) {
    const emoji = typeof node.attrs['emoji'] === 'string' ? node.attrs['emoji'] : '⭐';

    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'emoji', class: 'notio-emoji' }),
      ['span', { class: 'notio-emoji-value' }, emoji],
    ];
  },
  addNodeView() {
    return editableReactNodeView(EmojiView);
  },
});

/** Fallback markup for a media node without a node view (hydration, copying). */
function mediaFigureHTML(
  blockType: string,
  node: ProseMirrorNode,
  HTMLAttributes: Record<string, unknown>,
  label: string,
): DOMOutputSpec {
  const fileId = typeof node.attrs['fileId'] === 'string' ? node.attrs['fileId'] : '';
  const url = typeof node.attrs['url'] === 'string' ? node.attrs['url'] : '';
  const src = url || (fileId ? `/api/media/files/${fileId}` : '');
  const caption = typeof node.attrs['caption'] === 'string' ? node.attrs['caption'] : '';
  const width = typeof node.attrs['width'] === 'number' ? node.attrs['width'] : null;
  const fullWidth = node.attrs['fullWidth'] === true;

  return [
    'figure',
    mergeAttributes(HTMLAttributes, {
      'data-block-type': blockType,
      'data-full-width': fullWidth ? 'true' : 'false',
      ...(width !== null && !fullWidth ? { style: `width: ${width}%` } : {}),
    }),
    src ? ['img', { src, alt: caption || label }] : ['span', {}, label],
    ['figcaption', {}, caption],
  ];
}

/**
 * Link to a child page — an atomic node, like a Notion sub-page.
 *
 * The pageId attribute stays empty while the service creates the page: such a
 * node is not serialised into BlockContent (see pageContentFromNode) and is
 * not saved, and after the service responds attrs update to the real page data.
 */
const SubPageBlock = Node.create({
  name: 'subPage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      pageId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-page-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['pageId'] ? { 'data-page-id': attributes['pageId'] } : {},
      },
      title: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-title') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['title'] ? { 'data-title': attributes['title'] } : {},
      },
      icon: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-icon'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes['icon'] ? { 'data-icon': attributes['icon'] } : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-block-type="page"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const pageId = typeof node.attrs['pageId'] === 'string' ? node.attrs['pageId'] : '';
    const title = typeof node.attrs['title'] === 'string' ? node.attrs['title'] : '';
    const icon =
      typeof node.attrs['icon'] === 'string' && node.attrs['icon'].length > 0
        ? node.attrs['icon']
        : '📄';
    // Locale from <html lang>: renderHTML lives outside the React context.
    const isEnglish = document.documentElement.lang === 'en';

    const label =
      title ||
      (pageId
        ? isEnglish
          ? 'Untitled'
          : 'Без названия'
        : isEnglish
          ? 'Creating page…'
          : 'Создание страницы…');

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'page',
        class: 'notio-page-link',
        role: 'link',
        'aria-label': label,
      }),
      ['span', { class: 'notio-page-icon', 'aria-hidden': 'true' }, icon],
      ['span', { class: 'notio-page-title' }, label],
    ];
  },
  addKeyboardShortcuts() {
    return {
      // The selected node opens with Enter — like following a link.
      Enter: () => {
        const { selection } = this.editor.state;

        if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'subPage') {
          return false;
        }

        const pageId = selection.node.attrs['pageId'];

        if (typeof pageId === 'string' && pageId.length > 0) {
          subPageBridge(this.editor).openSubPage(pageId);
          return true;
        }

        return false;
      },
    };
  },
});

/**
 * Columns (as in Notion): 2–5 columns in one row block. Column children are
 * ordinary blocks: ownsBlockRow looks at parent=doc, so nested paragraphs get
 * no ids of their own and are saved inside the columns row
 * (see columnsContentFromNode).
 */
const ColumnsListBlock = Node.create({
  name: 'columnsList',
  group: 'block',
  content: 'columnsColumn+',
  defining: true,
  isolating: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { blockId: blockIdAttribute };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="columns"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'columns', class: 'notio-columns' }),
      0,
    ];
  },
});

/** A column without a React wrapper: used by renderHTML and serialisation. */
const ColumnsColumnBlock = Node.create({
  name: 'columnsColumn',
  content: 'block+',
  defining: true,
  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-column': '', class: 'notio-column' }),
      0,
    ];
  },
  // A contentful view without editableReactNodeView: PM manages
  // contenteditable inside contentDOM itself; no atomic wrapper is needed here.
  addNodeView() {
    return ReactNodeViewRenderer(ColumnsColumnView);
  },
});

/**
 * Block formula: an atom with LaTeX in attrs, rendered by a KaTeX node view.
 * An empty expression pasted from the slash menu opens for editing by itself.
 */
const EquationBlock = Node.create({
  name: 'equationBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      expression: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-expression') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['expression'] === 'string' && attributes['expression'].length > 0
            ? { 'data-expression': attributes['expression'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-block-type="equation"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-block-type': 'equation', class: 'notio-equation' }),
      ['span', {}, typeof node.attrs['expression'] === 'string' ? node.attrs['expression'] : ''],
    ];
  },
  addNodeView() {
    return editableReactNodeView(EquationBlockView);
  },
});

/**
 * Inline formula: an atom inside text. The value lives in attrs.expression
 * and serialises as the contract's {math} segment (see inlineSegmentsFromNode).
 */
const InlineMath = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      expression: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-expression') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['expression'] === 'string' && attributes['expression'].length > 0
            ? { 'data-expression': attributes['expression'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-inline-math]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const expression = typeof node.attrs['expression'] === 'string' ? node.attrs['expression'] : '';

    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-inline-math': '', 'data-expression': expression }),
      expression,
    ];
  },
  addNodeView() {
    return editableReactNodeView(InlineMathView);
  },
});

/**
 * Link to an existing page (not a child one): unlike subPage it stores only
 * pageId — the title is fetched through the bridge, so renaming the page does
 * not break the block. Without pageId the node is not serialised
 * (pageLink in nodeToContent) and is not saved.
 */
const PageLinkBlock = Node.create({
  name: 'pageLink',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      blockId: blockIdAttribute,
      pageId: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-page-id') ?? '',
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['pageId'] === 'string' && attributes['pageId'].length > 0
            ? { 'data-page-id': attributes['pageId'] }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'a[data-block-type="linkToPage"]' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const pageId = typeof node.attrs['pageId'] === 'string' ? node.attrs['pageId'] : '';

    return [
      'a',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'linkToPage',
        class: 'notio-page-link',
        'data-page-id': pageId,
        role: 'link',
        'aria-label': pageId ? uiText('pageLink') : uiText('pickPage'),
      }),
      ['span', { class: 'notio-page-title' }, pageId ? uiText('page') : uiText('pickPage')],
    ];
  },
  addNodeView() {
    return editableReactNodeView(PageLinkView);
  },
});

/**
 * Breadcrumbs of the current page: an atom without content, the path is
 * computed by the node view through the pages bridge.
 */
const BreadcrumbBlock = Node.create({
  name: 'breadcrumbBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { blockId: blockIdAttribute };
  },
  parseHTML() {
    return [{ tag: 'nav[data-block-type="breadcrumb"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'nav',
      mergeAttributes(HTMLAttributes, {
        'data-block-type': 'breadcrumb',
        class: 'notio-breadcrumb',
        'aria-label': uiText('breadcrumb'),
      }),
      ['span', { class: 'notio-breadcrumb-muted' }, '…'],
    ];
  },
  addNodeView() {
    return editableReactNodeView(BreadcrumbView);
  },
});

/**
 * A table row with a persisted height: dragging its bottom border writes
 * rowHeight into attrs (see RowResize), serialisation goes into the table's
 * content.rowHeights.
 */
const TableRowBlock = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute('data-row-height');

          return value === null ? null : Number.parseInt(value, 10);
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes['rowHeight'] === 'number'
            ? { 'data-row-height': String(attributes['rowHeight']) }
            : {},
      },
    };
  },
});

const ROW_RESIZE_CURSOR_CLASS = 'notio-row-resize';
/** Minimum row height while dragging the border. */
const ROW_RESIZE_MIN_HEIGHT = 24;
/** Half of the border capture zone, px. */
const ROW_RESIZE_ZONE = 4;

/**
 * Changing row heights by dragging the bottom border.
 *
 * Column widths are handled by the official columnResizing (Table resizable),
 * but prosemirror-tables has no heights — hence our own implementation: while
 * dragging the DOM is edited directly, and a single transaction with rowHeight
 * commits on mouseup. Undo history then contains one action instead of dozens
 * of transactions for every mousemove.
 */
/** Finds the height handle: the bottom border of the row under the cursor. */
function rowHandleAt(
  view: EditorView,
  x: number,
  y: number,
): { rowDom: HTMLElement; rowPos: number; bottom: number; height: number } | null {
  if (!view.editable || typeof document.elementFromPoint !== 'function') {
    // elementFromPoint is missing in jsdom — the test environment has no hit-testing.
    return null;
  }

  const target = document.elementFromPoint(x, y);
  const cell = target instanceof Element ? target.closest('td,th') : null;
  const rowDom = cell?.parentElement ?? null;

  if (!(cell instanceof HTMLElement) || !(rowDom instanceof HTMLElement)) {
    return null;
  }

  const table = cell.closest('table');

  if (!(table instanceof HTMLElement) || !view.dom.contains(table)) {
    return null;
  }

  const rect = rowDom.getBoundingClientRect();

  if (y < rect.bottom - ROW_RESIZE_ZONE || y > rect.bottom + ROW_RESIZE_ZONE) {
    return null;
  }

  // posAtDOM(tr, 0) points at the start of the row content: -1 gives the row's own position.
  const rowPos = view.posAtDOM(rowDom, 0) - 1;

  return { rowDom, rowPos, bottom: rect.bottom, height: rect.height };
}

const RowResize = Extension.create({
  name: 'notioRowResize',
  addProseMirrorPlugins() {
    const editor = this.editor;
    let drag: {
      rowDom: HTMLElement;
      rowPos: number;
      startY: number;
      startHeight: number;
    } | null = null;

    const onDragMove = (event: MouseEvent) => {
      if (!drag) {
        return;
      }

      const next = Math.max(
        ROW_RESIZE_MIN_HEIGHT,
        Math.round(drag.startHeight + (event.clientY - drag.startY)),
      );

      drag.rowDom.style.height = `${next}px`;
    };

    const onDragEnd = () => {
      const current = drag;

      drag = null;
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.body.classList.remove(ROW_RESIZE_CURSOR_CLASS);

      if (!current || editor.isDestroyed) {
        return;
      }

      const height = Math.round(current.rowDom.getBoundingClientRect().height);

      current.rowDom.style.height = '';

      const row = editor.state.doc.nodeAt(current.rowPos);

      if (row?.type.name === 'tableRow' && height >= ROW_RESIZE_MIN_HEIGHT) {
        editor.view.dispatch(
          editor.state.tr.setNodeMarkup(current.rowPos, undefined, {
            ...row.attrs,
            rowHeight: height,
          }),
        );
      }
    };

    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousemove: (view, event) => {
              const handle = drag ? null : rowHandleAt(view, event.clientX, event.clientY);

              view.dom.classList.toggle(ROW_RESIZE_CURSOR_CLASS, handle !== null);

              return false;
            },
            mouseleave: (view) => {
              view.dom.classList.remove(ROW_RESIZE_CURSOR_CLASS);

              return false;
            },
            mousedown: (view, event) => {
              if (event.button !== 0) {
                return false;
              }

              const handle = rowHandleAt(view, event.clientX, event.clientY);

              if (!handle) {
                return false;
              }

              event.preventDefault();

              drag = {
                rowDom: handle.rowDom,
                rowPos: handle.rowPos,
                startY: event.clientY,
                startHeight: handle.height,
              };

              document.addEventListener('mousemove', onDragMove);
              document.addEventListener('mouseup', onDragEnd);
              document.body.classList.add(ROW_RESIZE_CURSOR_CLASS);

              return true;
            },
          },
        },
      }),
    ];
  },
});

/**
 * Synchronises the table's attrs with the DOM.
 *
 * With resizable: true the table is drawn by the columnResizing plugin's own
 * TableView — it does not apply the node's attrs, so the data attributes
 * (blockId for finding the block, plus text/background colours) are written
 * here after every step.
 */
const TableDomAttrs = Extension.create({
  name: 'notioTableDomAttrs',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        view: () => ({
          update(updatedView: EditorView) {
            updatedView.state.doc.descendants((node, pos) => {
              if (node.type.name !== 'table') {
                return true;
              }

              const dom = updatedView.nodeDOM(pos);

              // For a table with a node view nodeDOM returns the tableWrapper.
              const tableEl =
                dom instanceof Element
                  ? (dom.closest('table') ?? dom.querySelector('table'))
                  : null;

              if (tableEl instanceof HTMLTableElement) {
                for (const [attrName, dataName] of [
                  ['blockId', 'data-block-id'],
                  ['color', 'data-color'],
                  ['backgroundColor', 'data-background-color'],
                ] as const) {
                  const value = node.attrs[attrName];

                  if (typeof value === 'string' && value.length > 0) {
                    tableEl.setAttribute(dataName, value);
                  } else {
                    tableEl.removeAttribute(dataName);
                  }
                }
              }

              return false;
            });
          },
        }),
      }),
    ];
  },
});

/** Outline of the cell with the cursor — the table's "focus". */
const TableCellFocus = Extension.create({
  name: 'notioTableCellFocus',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: (state) => {
            const cell = cellAround(state.selection.$from);

            if (!cell) {
              return null;
            }

            const node = cell.nodeAfter;

            if (!node || (node.type.name !== 'tableCell' && node.type.name !== 'tableHeader')) {
              return null;
            }

            return DecorationSet.create(state.doc, [
              Decoration.node(cell.pos, cell.pos + node.nodeSize, {
                class: 'notio-active-cell',
              }),
            ]);
          },
        },
      }),
    ];
  },
});

/**
 * The Markdown trigger `>` is taken by toggle, so a quote is toggled by a
 * quote mark — as in Notion. The official Blockquote from StarterKit does the rest.
 */
const QuoteInput = Extension.create({
  name: 'quoteInput',
  priority: 101,
  addInputRules() {
    return [
      new InputRule({
        find: /^"\s$/u,
        handler: ({ chain, range }) => {
          chain().focus().deleteRange(range).setBlockquote().run();
        },
      }),
    ];
  },
});

const DetailsSummaryBlock = DetailsSummary.extend({
  content: 'inline*',
});

const ToggleInput = Extension.create({
  name: 'toggleInput',
  priority: 101,
  addInputRules() {
    return [
      new InputRule({
        find: /^>\s$/u,
        handler: ({ state, range }) => {
          const transaction = state.tr.delete(range.from, range.to);

          replaceTextblockWithDetails(transaction, range.from);
        },
      }),
    ];
  },
});

/**
 * Набор расширений редактора.
 *
 * Mark-расширения (bold/italic/strike/code/link) включены: rich text
 * сериализуется в InlineSegment[] (ADR 0021). underline выключен — его нет
 * в контракте, включать нельзя, чтобы не терять форматирование.
 */
export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    bold: {},
    italic: {},
    strike: {},
    code: {},
    underline: false,
    link: {
      openOnClick: false,
      autolink: true,
      defaultProtocol: 'https:',
      HTMLAttributes: { rel: 'noopener noreferrer nofollow' },
    },
    trailingNode: false,
    listItem: false,
  }),
  TextColorMark,
  TextBackgroundMark,
  ListItemBlock,
  TaskList,
  TaskItem.configure({
    a11y: {
      checkboxLabel: (_node, checked) => uiTaskLabel(checked),
    },
  }),
  Details.configure({
    persist: true,
    openClassName: 'is-open',
    renderToggleButton: ({ element, isOpen }) => {
      element.setAttribute('aria-expanded', String(isOpen));
      element.setAttribute('aria-label', isOpen ? uiToggleLabel(false) : uiToggleLabel(true));
    },
  }),
  DetailsSummaryBlock,
  DetailsContent,
  BlockIdAttribute,
  BlockIdGuard,
  ImageBlock,
  VideoBlock,
  FileBlock,
  EmojiBlock,
  // resizable включает официальный columnResizing: перетаскивание границ
  // колонок, colgroup и атрибут colwidth у ячеек.
  Table.configure({ resizable: true }),
  TableRowBlock,
  TableHeader,
  TableCell,
  RowResize,
  TableCellFocus,
  TableDomAttrs,
  SubPageBlock,
  ColumnsListBlock,
  ColumnsColumnBlock,
  EquationBlock,
  InlineMath,
  PageLinkBlock,
  BreadcrumbBlock,
  QuoteInput,
  ToggleInput,
  SlashMenuExtension,
  BlockPlaceholder,
  DropTargetHighlight,
];
