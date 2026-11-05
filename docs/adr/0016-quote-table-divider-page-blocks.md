# ADR 0016. Quote, table, divider and subpages

- **Status:** accepted
- **Date:** 2026-10-23

## Context

The contract already described `quote` and `divider`, but they could not be inserted from the UI:
the slash menu had no commands for them. The `table` and `page` types did not exist at all. In
Notion the fourth basic scenario is the subpage: a page inside a page, shown in the document as a
link, opened on click and appearing in the sidebar tree.

Model constraints:

- `BlockContent` stores flat text (no marks) — rich text is planned for the realtime stage;
- autosave diffs the whole document: a node without a mapping to `BlockContent` would silently be
  deleted from the database, so every node must be mapped;
- `POST /pages` assigns the page id on the service — the client cannot know the `pageId` of a future
  block in advance.

## Decision

- **Quote and divider are official StarterKit nodes** (`blockquote`, `horizontalRule`): the mapping
  in `utils/block.ts` already existed, only slash commands and plus-menu nodes were added. The
  quote's markdown trigger is `"` (a space after the quote mark): `>` is taken by toggle. The `---`
  trigger for the divider comes from StarterKit without extra code.
- **The table is the official `@tiptap/extension-table`** (Table, TableRow, TableHeader, TableCell;
  resizable off). The contract has a flat `{ headerRow: boolean; rows: string[][] }` model: cells
  are text, and the first row of `tableHeader` counts as the header. A table is one `blocks` row:
  rows and cells are serialised into its content and get no `blockId`s of their own.
- **A subpage is an atomic `subPage` node and a new `page` block type** `{ pageId, title, icon }`.
  The child page is a regular `pages` row with `parentId` = the page owning the block; the block
  stores denormalised title/icon for display.
- **Optimistic subpage insertion** (`utils/sub-page.ts`): on the `/page` command the node is
  inserted immediately with an empty `pageId`, then `POST /api/pages` creates the page and the
  node's attrs are updated from the service response. A node without a `pageId` is not serialised
  into `BlockContent` — there is no race with autosave. If creation fails, the placeholder is
  replaced by an empty paragraph and the editor reports the error.
- **A React bridge in a WeakMap**: extensions know nothing about the network or the router — the
  `Editor` component puts two functions into a `WeakMap` (create a page through the facade hook's
  mutation, open a route). `editor.storage` does not fit: Tiptap types it with the DOM `Storage`
  interface, which has no index signature.
- **Opening on click** is handled by the editor container (`router.push` to
  `/workspaces/:workspaceId/:pageId`); from the keyboard, Enter on the selected node. The link has no
  `href`: the real route depends on the workspace, which the node does not know.

## Alternatives

- **Storing table cells as separate blocks.** Would reuse autosave, but cell order and table
  dimensions would have to be reconstructed from positions, and inserting a row would need a
  synchronous batch of requests. A flat model in one row is simpler and atomic.
- **Creating the page before inserting the block.** Simpler flow, but the block would appear after
  network latency, and a slow response would make the command look hung. Optimistic insertion gives
  the instant feedback Notion has.
- **ReactNodeViewRenderer for the subpage.** Would allow Next `<Link>` inside the node, but the
  project prefers official extensions without custom node views (see ADR 0013); `renderHTML` plus a
  click handler is enough.

## Consequences

- `BLOCK_TYPES` grew to 12 types; the registry in `utils/block.ts` and the contract schema are
  extended together (the compiler demands the new `case`).
- The subpage title is denormalised: renaming the child page does not update link blocks until
  reload. Synchronisation arrives with realtime events.
- If the user deletes the placeholder while the page is being created, the page remains in the tree
  as an empty one — as in Notion, where creation cannot be cancelled.
- Tables still lack column resizing and rich text in cells; these are deliberate scope boundaries,
  not architectural limitations.
