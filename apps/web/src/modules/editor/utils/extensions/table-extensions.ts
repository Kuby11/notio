import { TableRow } from '@tiptap/extension-table';
import { Plugin } from '@tiptap/pm/state';
import { cellAround } from '@tiptap/pm/tables';
import { type EditorView, Decoration, DecorationSet } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';

export const TableRowBlock = TableRow.extend({
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

export const RowResize = Extension.create({
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
export const TableDomAttrs = Extension.create({
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
export const TableCellFocus = Extension.create({
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
