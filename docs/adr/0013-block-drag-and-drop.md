# ADR 0013. Block drag and drop and the "plus" menu in the editor

- **Status:** accepted
- **Date:** 2026-10-20

## Context

In Notion a block can be dragged by its handle on the left, pulled out of a toggle or list, dropped
inside another block, and an adjacent "plus" button opens the menu and inserts a new block right
below the current one. The editor stores the document as a single ProseMirror tree rather than a
list of independent React components, so a plain `SortableContext` over a list of blocks does not
fit: it knows nothing about toggle/listItem nesting and would break positions inside the document.

## Decision

- The handle uses the official `@tiptap/extension-drag-handle-react` (`DragHandle`): it attaches
  native dragging to the current ProseMirror node and supports nesting through `nested` (listItem,
  taskItem, details). The handle and the "plus" button remain a fixed overlay inside `DragHandle`.
- dnd-kit is no longer used: the previous `DndContext`/`useDraggable` implementation was removed so
  it would not duplicate the native drag or break nesting.
- On drop ProseMirror moves the node itself in a transaction, so undo/redo, nested toggle blocks and
  `blockId` attrs are preserved.
- The handle appears when hovering a block; the internal `detailsSummary`/`detailsContent` nodes are
  excluded from drag candidates, so you drag the toggle itself or its child blocks.
- The "plus" button reuses `SlashMenu` in empty-query mode. Choosing a command creates an empty node
  of the needed type and inserts it below the source block; for `listItem` the neighbouring item
  stays in the same list, while a block of another type is inserted after the list. This is a
  ProseMirror schema limitation: an arbitrary block node cannot be placed between `listItem`s.

## Alternatives

- **A custom dnd-kit layer on top of ProseMirror.** Removed: it did not understand toggle/listItem
  nesting and duplicated the native drag that DragHandle already provides.
- **Native ProseMirror drag without a handle.** Does not allow showing the handle only on hover and
  easily conflicts with text selection.
- **`@tiptap/extension-drag-handle` (vanilla).** The same functionality without the React wrapper;
  the React version was chosen because the handle and "plus" render as React components.
- **The official paid `DragContextMenu`/`SlashDropdownMenu`.** Unavailable without a Start licence,
  so the open primitives `DragHandle`, `Suggestion` and our own `SlashMenu` are used.
- **Rebuilding the document from domain blocks after a drop.** Would lose nested nodes, cursor
  positions and undo/redo.

## Consequences

- Moving and inserting change the Tiptap document; debounced block autosave remains a separate task.
  Until it lands, changes live in the current editor session.
- Moving a `listItem` elsewhere flattens the nested list inside it into paragraph text: the
  `BlockContent` contract does not store nested lists as separate rows.
- To drop into a specific position inside a toggle you hover a neighbouring child block; the toggle
  heading drops into the end of its body.
