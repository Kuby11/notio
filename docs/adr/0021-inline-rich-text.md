# ADR 0021. Rich text: inline formatting of a selection

- **Status:** accepted
- **Date:** 2026-10-24

## Context

A bubble menu above selected text was required: bold, italic, strikethrough, inline code, link, text
colour and background. Until then `BlockContent` stored flat text — ADR 0011 and a note in the
contract postponed rich text to "Stage 5" (silently losing formatting on save was not acceptable).

## Decision

- **Model: `RichText = string | InlineSegment[]`.** A segment is a piece of text with marks
  (`bold/italic/strike/code/link/color/backgroundColor`). The string variant remains a valid contract
  for legacy data; the editor mapping always writes arrays on save, so the database is normalised on
  each page's first change. A table stores cells as `RichText[][]`, and toggle stores its heading and
  recursive children.
- **Exceptions stay flat:** code blocks (marks do not live there), image/video captions (node attrs,
  edited with a plain input), file name.
- **Colours are named presets**, not hex: the custom `textColor`/`textBg` marks render
  `data-text-color`/`data-text-bg`, and the palette and dark theme are served by CSS (one source with
  ADR 0017). The official Color/BackgroundColor write arbitrary hex into style and break the themes.
- **Autosave comparison canonicalises text:** `contentEquals` normalises both sides to segments before
  comparing — otherwise the first save after the migration would rewrite every block (string ≠
  array).
- **The bubble menu is the official BubbleMenu** from `@tiptap/react/menus` with `shouldShow`: a
  non-empty selection inside one textblock, not a code block. Its buttons are StarterKit mark
  commands; links go through `extendMarkRange` + `setLink` with `HttpUrlSchema` validation
  (http/https only); colours use the preset palette (clicking the same colour again removes the
  mark).

## Alternatives

- **Flat text plus a parallel array of mark ranges.** Would keep a string in the contract, but
  duplicates the text and desynchronises on every edit.
- **Arrays right away with no string variant.** Would break existing data and the smoke script; the
  string variant makes the migration lazy.
- **The official Color/BackgroundColor.** Hex in an inline style versus themes.
- **underline.** Deliberately absent from the contract: without a record in the model it would be
  lost; it is added later together with the schema.

## Consequences

- The contract's text fields became `RichText`; consumers of plain text (search, previews) use
  `richToPlain`.
- `contentEquals` canonicalises strings and segments — comparison is no longer strict on JSON, but
  the migration produces no false updates.
- Links in text open only outside editing (openOnClick is off); clicking them in reading mode arrives
  with read-only mode.
- Inside a code block the bubble menu is hidden — plain text there matches the model.
