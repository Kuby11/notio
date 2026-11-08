import { describe, expect, it } from 'vitest';
import { resizeImage, resizeImageByKeyboard } from './image-resize';

// Column 400px wide, left edge at 100. Container 1200px wide, full screen.
const COLUMN = { left: 100, right: 500, width: 400 };
const CONTAINER = { left: 0, right: 1200, width: 1200 };
// Wide floor as the container percent: 400 / 1200 = 33.33% → 33.
const FLOOR = 33;

describe('resizeImage: growth from the natural size (width: null)', () => {
  it('the first step grows the image from its actual edge, not from 100%', () => {
    // Image 300px in a 400px column, centred: the anchor (left edge) is at 50px.
    const result = resizeImage({
      side: 'right',
      clientX: 370, // the image's right edge was at 350 — the cursor sits 20px to the right
      state: { fullWidth: false, width: null, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 50,
    });

    expect(result).toEqual({ fullWidth: false, width: 55, wideWidth: null });
  });

  it('a cursor at the edge position does not change the size', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 350,
      state: { fullWidth: false, width: null, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 50,
    });

    expect(result).toEqual({ fullWidth: false, width: 50, wideWidth: null });
  });

  it('shrinking below the anchor is clamped to the minimum (10%)', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 120,
      state: { fullWidth: false, width: null, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 50,
    });

    expect(result).toEqual({ fullWidth: false, width: 10, wideWidth: null });
  });
});

describe('resizeImage: percent mode (width set)', () => {
  it('right handle: the edge follows the cursor from the fixed left edge', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 420,
      state: { fullWidth: false, width: 50, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0, // left edge at the column edge
    });

    expect(result).toEqual({ fullWidth: false, width: 80, wideWidth: null });
  });

  it('left handle is mirrored: dragging left grows the width', () => {
    const result = resizeImage({
      side: 'left',
      clientX: 180,
      state: { fullWidth: false, width: 50, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 400, // right edge at the column edge (500 - 100)
    });

    expect(result).toEqual({ fullWidth: false, width: 80, wideWidth: null });
  });

  it('a cursor past the column switches to wide mode (not full-width)', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 560,
      state: { fullWidth: false, width: 95, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    // |560 - 600| * 2 / 1200 = 6.7% -> clamped to the step (33.3% -> 34%).
    expect(result).toEqual({ fullWidth: false, width: null, wideWidth: FLOOR });
  });

  it('a cursor further past the column grows the wide image', () => {
    // Cursor at 1000: |1000 - 600| * 2 / 1200 = 66.7% → above the floor.
    const result = resizeImage({
      side: 'right',
      clientX: 1000,
      state: { fullWidth: false, width: null, wideWidth: FLOOR },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: false, width: null, wideWidth: 67 });
  });

  it('a cursor inside the column stays in percent mode', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 480,
      state: { fullWidth: false, width: 95, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: false, width: 95, wideWidth: null });
  });
});

describe('resizeImage: wide mode', () => {
  it('a cursor inside the column returns to percent mode', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 300,
      state: { fullWidth: false, width: null, wideWidth: 60 },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: false, width: 50, wideWidth: null });
  });

  it('a cursor past the container switches to full-width', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 1210,
      state: { fullWidth: false, width: null, wideWidth: 90 },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: true, width: null, wideWidth: null });
  });

  it('a cursor in the container (past the column) keeps wide mode and grows it', () => {
    // Cursor at 1100: |1100 - 600| * 2 / 1200 = 83.3%.
    const result = resizeImage({
      side: 'right',
      clientX: 1100,
      state: { fullWidth: false, width: null, wideWidth: 90 },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: false, width: null, wideWidth: 83 });
  });
});

describe('resizeImage: full mode', () => {
  it('a cursor in the column returns to percent mode', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 300,
      state: { fullWidth: true, width: 95, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: false, width: 50, wideWidth: null });
  });

  it('a cursor in the container (but past the column) returns to wide mode', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 900,
      state: { fullWidth: true, width: 95, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    // |900 - 600| * 2 / 1200 = 50%.
    expect(result).toEqual({ fullWidth: false, width: null, wideWidth: 50 });
  });

  it('a cursor past the container stays in full-width', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 1210,
      state: { fullWidth: true, width: 95, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: true, width: 95, wideWidth: null });
  });

  it('left handle in full-width: a cursor left of the container stays full', () => {
    const result = resizeImage({
      side: 'left',
      clientX: -10,
      state: { fullWidth: true, width: 90, wideWidth: null },
      column: COLUMN,
      container: CONTAINER,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: true, width: 90, wideWidth: null });
  });
});

describe('resizeImageByKeyboard', () => {
  it('the right arrow at the right handle grows the image', () => {
    expect(
      resizeImageByKeyboard({
        side: 'right',
        key: 'ArrowRight',
        state: { fullWidth: false, width: 50, wideWidth: null },
        containerRatio: 3,
      }),
    ).toEqual({ fullWidth: false, width: 55, wideWidth: null });
  });

  it('the left arrow at the left handle grows the image (mirrored)', () => {
    expect(
      resizeImageByKeyboard({
        side: 'left',
        key: 'ArrowLeft',
        state: { fullWidth: false, width: 50, wideWidth: null },
        containerRatio: 3,
      }),
    ).toEqual({ fullWidth: false, width: 55, wideWidth: null });
  });

  it('does not exceed 100 in percent mode', () => {
    expect(
      resizeImageByKeyboard({
        side: 'right',
        key: 'ArrowRight',
        state: { fullWidth: false, width: 99, wideWidth: null },
        containerRatio: 3,
      }),
    ).toEqual({ fullWidth: false, width: null, wideWidth: 33 });
  });
  it('wide mode: the right arrow grows up to 100% of the container', () => {
    expect(
      resizeImageByKeyboard({
        side: 'right',
        key: 'ArrowRight',
        state: { fullWidth: false, width: null, wideWidth: 40 },
        containerRatio: 3,
      }),
    ).toEqual({ fullWidth: false, width: null, wideWidth: 45 });
  });

  it('wide mode: the left arrow down to the floor returns to 100% of the column', () => {
    expect(
      resizeImageByKeyboard({
        side: 'right',
        key: 'ArrowLeft',
        state: { fullWidth: false, width: null, wideWidth: 36 },
        containerRatio: 3,
      }),
    ).toEqual({ fullWidth: false, width: 100, wideWidth: null });
  });

  it('full mode: an arrow returns to wide mode', () => {
    expect(
      resizeImageByKeyboard({
        side: 'right',
        key: 'ArrowRight',
        state: { fullWidth: true, width: 95, wideWidth: null },
        containerRatio: 3,
      }),
    ).toEqual({ fullWidth: false, width: null, wideWidth: 100 });
  });
});
