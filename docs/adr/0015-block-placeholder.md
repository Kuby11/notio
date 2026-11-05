# ADR 0015. Placeholder only in the block under the cursor

- **Status:** accepted
- **Date:** 2026-10-23

## Context

The `Press / for commands` hint should appear only in the empty block where the cursor is — including
list items, tasks and the toggle body. The official `Placeholder` from `@tiptap/extensions` has to be
configured as `showOnlyCurrent: true` + `includeChildren: true`: without `includeChildren` it only
looks at top-level textblocks and does not see nested ones.

With that combination the extension keeps decorations in a state field and, when the selection
changes, recomputes only the ranges of blocks affected by the transaction. Removing the old
decoration is limited to "fully inside the range", and the range recomputation is offset by one
relative to `nodesBetween` coordinates. As a result, moving from one empty block to another leaves
the previous block's decoration in place: the hint stays on it and a second one appears on the new
block. The bug reproduces in `@tiptap/extensions` 3.32.0.

## Decision

The official `Placeholder` was replaced with a `BlockPlaceholder` extension in
`utils/editor-extensions.ts`:

- decorations are computed in `props.decorations` from scratch on every render — there is no state
  and no incremental recomputation, so nothing can get stuck;
- from the cursor upwards through ancestors it finds the nearest textblock; if it is empty, a node
  decoration with `is-empty` and `data-placeholder` is placed on it;
- emptiness is determined recursively: no text and no atoms such as `hardBreak`;
- `isEditable` is checked on every render, like `showOnlyWhenEditable`;
- the hint text and CSS selector are unchanged, so globals.css was not touched.

Nesting is handled by the ancestor search itself: a list item, a task and a toggle summary are
textblocks just like a paragraph.

## Alternatives

- **Patching `node_modules` or forking `@tiptap/extensions`.** Treats the symptom but complicates
  dependency upgrades and duplicates the package's internal logic.
- **`showOnlyCurrent: false`.** Would mean hiding the hint in CSS, but CSS does not know the cursor
  position; a separate extension would be needed — the same amount of code, but with two sets of
  decorations.
- **Enabling `includeChildren` only for nested blocks.** The extension has no such mode.

## Consequences

- The hint is not shown in an empty document with no blocks at all: ProseMirror has no textblock to
  attach it to. The Notion-like editor always hydrates at least one block from the database.
- When upgrading Tiptap it is worth re-checking the official extension's behaviour: if the bug is
  fixed, the custom one can be removed.
