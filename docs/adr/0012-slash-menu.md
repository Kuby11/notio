# ADR 0012. Slash menu and markdown triggers in the editor

- **Status:** accepted
- **Date:** 2026-10-20

## Context

We need to reproduce Notion's familiar behaviour: typing `/` opens the block menu, the query after
the slash filters the list, the arrow keys move the selection, `Enter` inserts the block and `Esc`
closes the menu. The menu needs text, headings 1–4, a toggle list, numbered, to-do and bulleted
lists. Next to each block's name we should show the markdown character that creates that block when
typed.

According to the Notion documentation:

- `/` opens the full block menu, while `/text`, `/plain`, `/bullet`, `/num`, `/todo`, `/toggle`, `/h1`
  (`/#`), `/h2` (`/##`) and `/h3` (`/###`) are quick commands; `Esc` clears the menu.
- Markdown triggers: `-`, `*` or `+` + `Space` for a bulleted list, `1.` + `Space` for a numbered
  list, `[]` + `Space` for to-do, `#`/`##`/`###` + `Space` for H1–H3, `>` + `Space` for toggle.
- At the top of the menu Notion shows the most used and recent blocks.

H4 appeared in Notion later, and the help docs have no separate markdown trigger for it. We treat
`####` as the standard Markdown equivalent and support it alongside the other headings.

## Decision

- The slash menu is a controlled popover rendered next to the editor. Its state (`open`, `query`,
  the range of `/query`) lives in the module's Zustand store, while the editor data stays in
  Tiptap/TanStack Query.
- The menu opens when `/` sits at the start of a text block or after whitespace. Inside a word or
  URL, inside a code block, or with a non-empty selection the menu does not open.
- `findSlashTrigger` computes the absolute range of `/query`; choosing a command deletes the range
  and turns the current block into the chosen type. Text before the slash is preserved.
- Filtering matches the name, English/Russian synonyms and the markdown character. Exact matches
  first (`/h2`, `/##`), then prefix matches, then substrings. Without usage history the order is
  fixed.
- Keyboard: `ArrowUp`/`ArrowDown` wrap around, `Enter` inserts, `Esc` closes. After `Esc` the menu
  does not reopen for the same slash until it is deleted. Clicking outside and scrolling the page
  close the popover.
- Input rules were added for the markdown triggers:
  - headings — Tiptap's built-in rules with `levels: [1, 2, 3, 4]`;
  - `[]` + `Space` — to-do;
  - `>` + `Space` — toggle; the toggle rule has higher priority than the built-in blockquote,
    otherwise `>` would become a quote;
  - lists `-` and `1.` use StarterKit's built-in rules.
- `BlockContentSchema` was extended with heading level `4`; the mapping and the Tiptap `Heading`
  extension are kept in sync with that level.

## Alternatives

- **`@tiptap/suggestion` + ReactRenderer.** Provides a ready trigger lifecycle, but requires
  separate popover positioning and complicates range/focus management. For a single menu per page
  it is simpler to keep the range in the shared UI store and reuse `Editor` events.
- **Showing only commands, without markdown hints.** Fails the requirement to explain which
  characters produce a block, and gives the user no fast way to create a block without the menu.
- **Sorting by usage frequency.** There is no command history or cross-device sync yet; a fixed
  order is predictable and easier to test.

## Consequences

- The menu currently contains only the basic blocks from the requirement. `image`, `code`, `quote`
  and `divider` remain available through the mapping but are not shown in the slash menu.
- There are no "Recent" and "Frequently used" sections; these can be added later, keeping history
  in UI state or on the server.
- Toggle became a container: its heading and child blocks live in its `content.children`; the arrow
  rotates and the body hides when `open: false`. Nested lists inside a toggle are still flattened
  into a plain `BlockContent[]`.
- Inserting from the menu changes the Tiptap document; saving those changes arrives with debounced
  block autosave.

## References

- [Notion Help — Keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts)
- [Notion Help — Intro to writing & editing](https://www.notion.com/help/writing-and-editing-basics)
