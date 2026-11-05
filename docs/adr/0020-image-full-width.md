# ADR 0020. Image width: column percentage and 16:9 full-width

- **Status:** accepted
- **Date:** 2026-10-24

## Context

Image width is changed by dragging the side handles. In Notion, dragging beyond the text column
expands the image to the full workspace area, and the user asked for a 16:9 frame in that mode.
Constraints: `BlockContent` is flat JSON in a `blocks` row (geometry must serialise), and rendering
lives in a React node view inside the column (`tiptap { max-width: 52rem }`).

## Decision

- **Two modes in one contract field.** `width` is the percentage of the column (10–100);
  `fullWidth: true` is the "full workspace width" mode. In full width, `width` keeps the last
  percentage: shrinking back returns the image to it.
- **The switch trigger is the cursor beyond the column edge**, not a computed width: the handle may
  have started away from the column edge, and a width derived from the delta would never reach the
  threshold (verified in E2E). The step logic is extracted into a pure function `resizeImage`
  (utils/image-resize, 12 tests): the percentage is computed from the cursor position in the column,
  and the left handle is mirrored.
- **Full bleed without CSS vw tricks** (they slide under the sidebar): the node view measures the
  editor container (`[data-editor-container]`) and the column (`ProseMirror`) and gives the figure the
  container's width and a negative offset in px. A ResizeObserver recomputes on window and sidebar
  resizes.
- **A 16:9 frame in full width**: `aspect-ratio: 16 / 9` on the frame and `object-fit: cover` on the
  image — the picture's proportions are not distorted, and the excess is cropped from the centre.
- **The handle's tooltip** shows the percentage within the column and "Full width" in full width.
  Keyboard arrows change the percentage in steps of 5.

## Alternatives

- **`width: number | 'full'`** instead of a separate flag: width and mode in one field, but it breaks
  existing data (100 → 'full') and complicates validation.
- **CSS `100vw` / container queries** for full bleed: the first slides under the sidebar, the second
  makes the container a containing block for fixed elements and breaks menu positioning.
- **Storing full width as width > 100**: breaks the percentage contract and its validation.

## Consequences

- In full width the image is cropped to 16:9 — the original proportions are kept only in percentage
  mode.
- Full-bleed measurement lives in the node view: switching the mode can produce one frame without
  styles before the first measurement (masked by measuring synchronously in an effect).
- Clicking/the cursor around a full-width image still resolves to the "before the block" position via
  the posAtCoords patch (see the editor history) — the node's vertical range matches the visual one.
