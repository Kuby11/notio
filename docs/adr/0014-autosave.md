# ADR 0014. Autosaving the document with a 1000 ms debounce

- **Status:** accepted
- **Date:** 2026-10-23

## Context

The editor keeps the whole page document in Tiptap, while the database stores blocks as separate
`blocks` rows with fractional indexing. While the user types, changes live only in ProseMirror:
without autosave they are lost on reload. Saving on every keystroke is not an option — that is
dozens of requests per second.

API constraints:

- there is no "replace the whole document" endpoint — only per-block operations;
- `POST /blocks` ignores `afterBlockId` and appends the block to the end of the page;
- `POST /blocks/:id/move` places a block **after** a neighbour, and there is no single operation
  that makes a block the first one;
- `PATCH /blocks/:id` accepts only `content` (the type is derived from it).

## Decision

- **1000 ms debounce** in the `useEditor` facade hook: the component passes the current document
  JSON, the hook keeps the latest snapshot and sends it `AUTOSAVE_DELAY_MS` after the last change.
  Sending and diffing do not live in the component.
- **The diff is computed from a full snapshot**: `planAutosave` compares blocks from the Query cache
  with editor blocks and returns deletions, updates, creations and the final order. Content
  comparison does not depend on key order.
- **Order is restored with moves**: creations run in document order, then `planMoves` returns the
  minimal set of `move` operations relative to the neighbour above. The first block is not moved —
  to put it at the start, the others move behind it. That is how the API limitation is worked
  around.
- **The client assigns ids to new blocks**: the `BlockIdGuard` plugin in `editor-extensions` gives
  `blockId` to nodes without one and separates ids that ProseMirror copies when a block is split.
  The hook keeps a map "temporary id → id from the service response", so a repeated save updates the
  block instead of creating a duplicate.
- **The snapshot immediately becomes the document cache** (`setQueryData`): the next diff is computed
  from it without waiting for a refetch. Operations are applied sequentially; the snapshot is also
  updated on a partial failure, so completed operations are not repeated.
- **Status** (`pending`/`saving`/`saved`/`error`) is exposed from the hook; a spinner rotates in the
  editor's top-right corner while saving, and an error is shown as text. After an error the document
  is not lost: the next change sends the full diff again.

## Alternatives

- **Saving on every change.** Simple, but turns typing into a stream of requests and hits the
  gateway rate limit.
- **A new "replace all blocks" endpoint.** Cleaner for the client, but requires a transaction and
  versioning on the service; postponed until the realtime stage.
- **Yjs/CRDT.** Would give collaborative editing, but is overkill at this point: the document is
  single-user and conflicts are resolved by last write.

## Consequences

- Save confirmation arrives about 1 s after a pause; leaving the page quickly within the debounce
  window can lose the last edit.
- A failed save is not retried automatically — the retry happens on the next document change.
