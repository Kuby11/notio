/**
 * Image width logic, as in Notion but with three states:
 *
 * 1. Normal — the image lives in the text column, the width is a percent of
 *    the column (10–100), centred inside it.
 * 2. Wide — the cursor crossed the column edge: the image breaks out of the
 *    column and grows continuously, centred in the editor container. The
 *    width is a percent of the container (`wideWidth`, between the column
 *    share and 100%). Natural aspect is kept.
 * 3. Fullscreen — the cursor crossed the container edge: the image spans the
 *    whole workspace width with a 16:9 frame. Dragging back re-enters wide.
 *
 * Pure functions — rendering and events live in the node view.
 */

/** Image width bounds as a percentage of the column. */
export const IMAGE_WIDTH_MIN = 10;
export const IMAGE_WIDTH_MAX = 100;

/** Tolerance of the state-switch triggers, px past the edge. */
export const RESIZE_EDGE_TOLERANCE = 8;

/** Image width state at the moment of dragging. */
export interface ImageSizeState {
  fullWidth: boolean;
  /** Column percent (10–100); kept while wide/full for the keyboard step. */
  width: number | null;
  /** Container percent in wide mode; null outside it. */
  wideWidth: number | null;
}

export interface ImageResizeRect {
  left: number;
  right: number;
  width: number;
}

export interface ImageResizeInput {
  side: 'left' | 'right';
  /** Current horizontal cursor position. */
  clientX: number;
  state: ImageSizeState;
  /** Rectangle of the editor's text column. */
  column: ImageResizeRect;
  /** Rectangle of the editor container (the wide/fullscreen bounds). */
  container: ImageResizeRect;
  /**
   * The pinned (handle-opposite) edge of the figure in px from column.left,
   * captured at drag start (normal mode).
   */
  anchorPx: number;
}

/** Result of a drag step: the new width state. Nulls clear the attributes. */
export interface ImageResizeResult {
  fullWidth: boolean;
  width: number | null;
  wideWidth: number | null;
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
  column: ImageResizeRect,
): number {
  const raw =
    side === 'right'
      ? ((clientX - column.left) / column.width) * 100
      : ((column.right - clientX) / column.width) * 100;

  return Math.round(raw);
}

/**
 * The container percent of a wide image centred in the container whose edge
 * follows the cursor: the distance from the container centre to the cursor
 * doubled — the opposite edge grows symmetrically.
 */
function widePercentFromCursor(clientX: number, container: ImageResizeRect): number {
  const center = container.left + container.width / 2;
  const half = Math.abs(clientX - center);
  const raw = ((half * 2) / container.width) * 100;

  return Math.round(raw);
}

/**
 * The wide percent continuous with the column at its edge: at the moment the
 * cursor crosses the column edge the image takes exactly the column width,
 * i.e. `column.width / container.width` of the container.
 */
function wideFloorPercent(column: ImageResizeRect, container: ImageResizeRect): number {
  return (column.width / container.width) * 100;
}

/** Step of the image handle drag. */
export function resizeImage(input: ImageResizeInput): ImageResizeResult {
  const { side, clientX, state, column, container, anchorPx } = input;
  const wide = state.wideWidth !== null && !state.fullWidth;

  const beyondColumn =
    side === 'right'
      ? clientX > column.right + RESIZE_EDGE_TOLERANCE
      : clientX < column.left - RESIZE_EDGE_TOLERANCE;
  const beyondContainer =
    side === 'right'
      ? clientX > container.right + RESIZE_EDGE_TOLERANCE
      : clientX < container.left - RESIZE_EDGE_TOLERANCE;

  // Fullscreen: dragging back inside the container re-enters wide (or normal
  // when the cursor comes back into the column).
  if (state.fullWidth) {
    if (beyondContainer) {
      return { fullWidth: true, width: state.width, wideWidth: null };
    }

    const columnCandidate = percentFromCursor(side, clientX, column);

    if (columnCandidate > IMAGE_WIDTH_MAX) {
      return {
        fullWidth: false,
        width: null,
        wideWidth: Math.round(widePercentFromCursor(clientX, container)),
      };
    }

    return { fullWidth: false, width: clampWidth(columnCandidate), wideWidth: null };
  }

  if (wide) {
    if (beyondContainer) {
      return { fullWidth: true, width: state.width, wideWidth: null };
    }

    // Back inside the column: the width snaps to the cursor position in the
    // column percents — continuous with the wide floor at the boundary.
    if (!beyondColumn) {
      return {
        fullWidth: false,
        width: clampWidth(percentFromCursor(side, clientX, column)),
        wideWidth: null,
      };
    }

    return {
      fullWidth: false,
      width: null,
      wideWidth: Math.max(
        widePercentFromCursor(clientX, container),
        Math.round(wideFloorPercent(column, container)),
      ),
    };
  }

  // Normal mode.
  if (beyondContainer) {
    return { fullWidth: true, width: state.width, wideWidth: null };
  }

  if (beyondColumn) {
    return {
      fullWidth: false,
      width: null,
      wideWidth: Math.max(
        widePercentFromCursor(clientX, container),
        Math.round(wideFloorPercent(column, container)),
      ),
    };
  }

  const rawWidth =
    side === 'right'
      ? ((clientX - column.left - anchorPx) / column.width) * 100
      : ((column.left + anchorPx - clientX) / column.width) * 100;

  return { fullWidth: false, width: clampWidth(Math.round(rawWidth)), wideWidth: null };
}

/**
 * Keyboard resize step (arrow keys). Normal: ±5 of the column percent.
 * Wide: ±5 of the container percent with the wide floor — dropping to the
 * floor returns to normal at 100%. Fullscreen: arrows return to wide.
 */
export function resizeImageByKeyboard(input: {
  side: 'left' | 'right';
  key: 'ArrowLeft' | 'ArrowRight';
  state: ImageSizeState;
  /**
   * container.width / column.width — the wide-mode ceiling in column percents.
   * Optional: when the caller cannot measure the container, the image cannot
   * break out — ratio 1 keeps every step inside the column.
   */
  containerRatio?: number;
}): ImageResizeResult {
  const containerRatio = input.containerRatio ?? 1;
  const step = (input.key === 'ArrowRight' ? 5 : -5) * (input.side === 'right' ? 1 : -1);

  if (input.state.fullWidth) {
    return { fullWidth: false, width: null, wideWidth: 100 };
  }

  if (input.state.wideWidth !== null) {
    const wide = input.state.wideWidth + step;
    // The floor is the column share of the container: the wide image equal to
    // the column width returns to the normal 100%.
    const floor = IMAGE_WIDTH_MAX / containerRatio;

    if (wide <= floor) {
      return { fullWidth: false, width: IMAGE_WIDTH_MAX, wideWidth: null };
    }

    return { fullWidth: false, width: null, wideWidth: Math.min(100, Math.round(wide)) };
  }

  const raw = (input.state.width ?? IMAGE_WIDTH_MAX) + step;

  if (raw > IMAGE_WIDTH_MAX) {
    return {
      fullWidth: false,
      width: null,
      wideWidth: Math.min(100, Math.round(IMAGE_WIDTH_MAX / containerRatio)),
    };
  }

  return { fullWidth: false, width: clampWidth(raw), wideWidth: null };
}
