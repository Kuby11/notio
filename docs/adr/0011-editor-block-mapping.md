# ADR 0011. Editor: one Tiptap document ↔ separate block rows

- **Status:** accepted
- **Date:** 2026-10-20

## Context

Stage 5 requires storing each block as a separate `blocks` row and producing full page snapshots
from `BlockContent[]`. Tiptap works with a single nested ProseMirror document, where lists,
blockquotes and code are tree nodes rather than a flat list of blocks.

Both models have to be combined: edit the page in one editor, but save blocks row by row and be able
to map an editor node to a database row for autosave and selection.

## Decision

- **One** Tiptap editor and one ProseMirror document are created per page.
- Top-level document nodes correspond to page blocks: `paragraph`, `heading`, `blockquote`,
  `codeBlock`, `horizontalRule`, `bulletList`/`orderedList` (one per `listItem`) and the custom
  `image`, `toDo`, `toggle`.
- The persisted `block.id` is stored in each node's `blockId` attr. A new block not yet in the
  database has `blockId` equal to `null`.
- Conversion `Block[] → JSON document` and back lives in the pure `utils/block.ts` and does not
  depend on React or Tiptap. This makes the mapping testable without a DOM.
- Adjacent list items are merged into one `bulletList` or `orderedList` during hydration; on save,
  each `listItem` becomes a separate block again.
- Selection is determined by the nearest ancestor with a `blockId`, not by a ProseMirror position.
  For atomic nodes (`image`, `divider`) the id comes from `NodeSelection`.
- Tiptap mark extensions (bold, italic, link, etc.) are disabled: the current `BlockContent` stores
  a flat string. Enabling formatting that cannot be saved would silently lose the user's data.

## Alternatives

- **A separate Tiptap editor per block.** Simpler 1:1 mapping, but breaks cursor navigation across
  blocks, undo/redo and drag & drop between blocks; a page with a hundred blocks gets a hundred
  ProseMirror views.
- **Storing Tiptap JSON as one document.** Contradicts per-row blocks, partial updates and
  `BlockContent[]` snapshots.
- **BlockNote.** A ready-made block UI, but less control over the schema and our own architecture;
  for a portfolio it matters to demonstrate the mapping and autosave ourselves.

## Consequences

- Rich text (marks) will appear only together with migrating `BlockContent` to an array of inline
  nodes; until then the editor stays plain-text per block.
- List nesting is flattened into blocks on save: the `BlockContent` contract cannot yet store a
  hierarchy.
- Toggle keeps its nested blocks in its own row's `content.children`. This is the only exception to
  "one block, one row": the toggle's heading and body are saved atomically, without separate
  `blockId`s on the children. Nested lists inside a toggle are flattened, as at the top level.
- The custom nodes (`image`, `toDo`, `toggle`) must change together with the mapping and the
  contract; unit tests pin this down.
- The database still holds only domain `BlockContent`; Tiptap JSON is the editor's temporary
  representation, not the storage format.
