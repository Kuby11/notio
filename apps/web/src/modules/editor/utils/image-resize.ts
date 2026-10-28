/**
 * Image width logic, as in Notion: dragging the handle changes the column
 * percent, and leaving the column puts the image into "full workspace width"
 * mode (16:9 frame). Dragging back restores percent mode. Pure functions —
 * rendering and events live in the node view.
 */

/** Image width bounds as a percentage of the column. */
export const IMAGE_WIDTH_MIN = 10;
export const IMAGE_WIDTH_MAX = 100;

/** Image width state at the moment of dragging. */
export interface ImageSizeState {
  fullWidth: boolean;
  /** Column percent (10–100); in full-width it is kept for restoring. */
  width: number | null;
}

export interface ImageResizeInput {
  side: 'left' | 'right';
  /** Current horizontal cursor position. */
  clientX: number;
  state: ImageSizeState;
  /** Rectangle of the editor's text column. */
  column: { left: number; right: number; width: number };
  /**
   * The pinned (handle-opposite) edge of the figure in px from column.left.
   * The width is computed from it absolutely — the image grows from its actual
   * size (including the natural one while width is still null).
   */
  anchorPx: number;
}

/** Result of a drag step: the new width state. */
export interface ImageResizeResult {
  fullWidth: boolean;
  width: number | null;
}

function clampWidth(value: number): number {
  return Math.min(IMAGE_WIDTH_MAX, Math.max(IMAGE_WIDTH_MIN, Math.round(value)));
}

/**
 * The column percent the block would take with the handle at the cursor:
 * the right handle defines the right edge, the left one the left.
 */
function percentFromCursor(
  side: 'left' | 'right',
  clientX: number,
  column: ImageResizeInput['column'],
): number {
  const raw =
    side === 'right'
      ? ((clientX - column.left) / column.width) * 100
      : ((column.right - clientX) / column.width) * 100;

  return Math.round(raw);
}

/** Step of the image handle drag. */
export function resizeImage(input: ImageResizeInput): ImageResizeResult {
  const { side, clientX, state, column, anchorPx } = input;

  // In full-width the handle measures the percent from the cursor position in the column:
  // dragged back inside the column — we return to percent mode.
  if (state.fullWidth) {
    const candidate = percentFromCursor(side, clientX, column);

    if (candidate >= IMAGE_WIDTH_MAX) {
      return { fullWidth: true, width: state.width };
    }

    return { fullWidth: false, width: clampWidth(candidate) };
  }

  // The width runs from the pinned edge to the cursor, absolutely: the right handle
  // holds the left edge (and vice versa); the edge under the cursor follows it.
  const rawWidth =
    side === 'right'
      ? ((clientX - column.left - anchorPx) / column.width) * 100
      : ((column.left + anchorPx - clientX) / column.width) * 100;

  const next = Math.round(rawWidth);

  // The cursor leaving the column edge switches to full-width. Trigger by
  // the cursor with a tolerance: the image edge has already reached the column edge.
  const beyondColumn = side === 'right' ? clientX > column.right + 8 : clientX < column.left - 8;

  if (beyondColumn) {
    return { fullWidth: true, width: state.width };
  }

  return { fullWidth: false, width: clampWidth(next) };
}

/** Keyboard resize step (arrow keys), in percent mode. */
export function resizeImageByKeyboard(input: {
  side: 'left' | 'right';
  key: 'ArrowLeft' | 'ArrowRight';
  state: ImageSizeState;
}): ImageResizeResult {
  const step = (input.key === 'ArrowRight' ? 5 : -5) * (input.side === 'right' ? 1 : -1);
  const width = clampWidth((input.state.width ?? IMAGE_WIDTH_MAX) + step);

  return { fullWidth: false, width };
}
