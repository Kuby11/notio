import { describe, expect, it } from 'vitest';
import { resizeImage, resizeImageByKeyboard } from './image-resize';

const COLUMN = { left: 100, right: 500, width: 400 };

describe('resizeImage: рост от натурального размера (width: null)', () => {
  it('первый шаг растит изображение от его фактического края, а не со 100%', () => {
    // Image 300px in a 400px column, centred: the anchor (left edge) is at 50px.
    const result = resizeImage({
      side: 'right',
      clientX: 370, // the image's right edge was at 350 — the cursor sits 20px to the right
      state: { fullWidth: false, width: null },
      column: COLUMN,
      anchorPx: 50,
    });

    expect(result).toEqual({ fullWidth: false, width: 55 });
  });

  it('курсор на месте края не меняет размер', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 350,
      state: { fullWidth: false, width: null },
      column: COLUMN,
      anchorPx: 50,
    });

    expect(result).toEqual({ fullWidth: false, width: 50 });
  });

  it('сжатие ниже якоря ограничивается минимумом (10%)', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 120,
      state: { fullWidth: false, width: null },
      column: COLUMN,
      anchorPx: 50,
    });

    expect(result).toEqual({ fullWidth: false, width: 10 });
  });
});

describe('resizeImage: процентный режим (width задан)', () => {
  it('правая ручка: край следует за курсором от закреплённого левого', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 420,
      state: { fullWidth: false, width: 50 },
      column: COLUMN,
      anchorPx: 0, // left edge at the column edge
    });

    expect(result).toEqual({ fullWidth: false, width: 80 });
  });

  it('левая ручка зеркальна: тянем влево — ширина растёт', () => {
    const result = resizeImage({
      side: 'left',
      clientX: 180,
      state: { fullWidth: false, width: 50 },
      column: COLUMN,
      anchorPx: 400, // right edge at the column edge (500 - 100)
    });

    expect(result).toEqual({ fullWidth: false, width: 80 });
  });

  it('выход курсора за колонку переключает в full-width и запоминает процент', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 560,
      state: { fullWidth: false, width: 95 },
      column: COLUMN,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: true, width: 95 });
  });

  it('курсор внутри колонки не переключает в full-width', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 480,
      state: { fullWidth: false, width: 95 },
      column: COLUMN,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: false, width: 95 });
  });
});

describe('resizeImage: полный режим', () => {
  it('курсор в колонке возвращает процентный режим', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 300,
      state: { fullWidth: true, width: 95 },
      column: COLUMN,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: false, width: 50 });
  });

  it('курсор за колонкой остаётся в full-width', () => {
    const result = resizeImage({
      side: 'right',
      clientX: 520,
      state: { fullWidth: true, width: 95 },
      column: COLUMN,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: true, width: 95 });
  });

  it('левая ручка в full-width: курсор левее колонки остаётся full', () => {
    const result = resizeImage({
      side: 'left',
      clientX: 80,
      state: { fullWidth: true, width: 90 },
      column: COLUMN,
      anchorPx: 0,
    });

    expect(result).toEqual({ fullWidth: true, width: 90 });
  });
});

describe('resizeImageByKeyboard', () => {
  it('стрелка вправо у правой ручки увеличивает', () => {
    expect(
      resizeImageByKeyboard({
        side: 'right',
        key: 'ArrowRight',
        state: { fullWidth: false, width: 50 },
      }),
    ).toEqual({ fullWidth: false, width: 55 });
  });

  it('стрелка влево у левой ручки увеличивает (зеркально)', () => {
    expect(
      resizeImageByKeyboard({
        side: 'left',
        key: 'ArrowLeft',
        state: { fullWidth: false, width: 50 },
      }),
    ).toEqual({ fullWidth: false, width: 55 });
  });

  it('не выходит за 100', () => {
    expect(
      resizeImageByKeyboard({
        side: 'right',
        key: 'ArrowRight',
        state: { fullWidth: false, width: 99 },
      }),
    ).toEqual({ fullWidth: false, width: 100 });
  });
});
