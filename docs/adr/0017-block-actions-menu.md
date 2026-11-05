# ADR 0017. Block actions menu: turn into, colour, duplicate, delete

- **Status:** accepted
- **Date:** 2026-10-23

## Context

The block drag handle (DragHandle) showed a plus and "dots", but the dots themselves opened nothing.
In Notion they open the block actions menu: turn into another type, recolour text and background,
duplicate, delete.

Constraints:

- BlockContent stores flat text without marks — a mark-based approach to colour (TextStyle) would
  lose formatting on autosave, which is explicitly forbidden by a comment in editor-extensions (see
  the disabled bold/italic);
- autosave diffs the whole document: node attrs not reflected in BlockContent would silently vanish
  after reload;
- toggle keeps its children inside its own row, while a quote's blockText reads only paragraphs —
  converting containers directly would lose content.

## Decision

- **Colour lives in content fields, not marks.** Seven text types (paragraph, heading, both lists,
  toDo, quote, toggle) gained optional `color`/`backgroundColor` with named presets (`gray…red`,
  nine of them, as in Notion). Presets instead of arbitrary hex give a consistent look in light/dark
  themes (CSS in globals.css) and cheap Zod validation. In the editor these are global
  `data-color`/`data-background-color` attrs on the paragraph, heading, quote, list items and
  details: text inherits the node's colour and the background fills the block.
- **Turning into reuses slash commands.** `turnIntoBlock` places the cursor in the block's first
  textblock and calls `applySlashCommand` with an empty range. The target list is TURN_INTO_OPTIONS
  (text, H1–H4, lists, tasks, toggle, quote, code); the current type is checked via
  `currentTurnIntoOptionId` and is not applied again. Containers are unwrapped first: toggle becomes
  its heading paragraph plus its children, and a code block becomes a paragraph (otherwise quoting
  swallowed the text).
- **Duplicate inserts a copy of the node** right below the original. The copy carries the same
  `blockId`, but BlockIdGuard sees the duplicate and assigns a new id, so autosave creates a separate
  row.
- **Delete uses deleteRange** with replacement by an empty paragraph when the block was the only
  one: an empty document is invalid per the ProseMirror schema.
- **The menu is a fixed popover** `BlockActionsMenu` at the handle's button (a click without
  movement; movement still starts a drag). The nested "Turn into" and "Colour" views switch inside
  the popover; Escape closes it and the arrow keys move focus across buttons.

## Alternatives

- **Colour via TextStyle/mark.** Fewer contract changes, but formatting is lost on save — contrary
  to the already recorded decision not to enable marks before the rich-text stage.
- **Arbitrary HEX values.** More flexible, but requires palette validation, duplicated values
  between the contract and CSS, and a dark-theme decision for every colour. Presets remove all of
  that.
- **Menu components from shadcn (DropdownMenu).** The closest primitive is designed for an in-flow
  trigger, not a fixed position at the handle; nested lists and the swatch grid would still be
  custom.

## Consequences

- `BlockContent` for text types gained two optional fields; old data is valid without migration and
  the new fields are ignored by old code.
- Colour does not apply to code, tables, dividers, images and subpages — those types have no colour
  fields, and the menu simply hides the action.
- Turning a toggle into something else unwraps its children: collapsed state is lost, content is
  not.
- The same preset set for text and background is a deliberate simplification: custom combinations
  (for example "yellow background + gray text") remain for the rich-text stage.
