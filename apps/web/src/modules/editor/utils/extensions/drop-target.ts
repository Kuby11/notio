import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { dropPoint } from '@tiptap/pm/transform';
import type { EditorView } from '@tiptap/pm/view';
import { Extension } from '@tiptap/react';

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
export const DropTargetHighlight = Extension.create({
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
