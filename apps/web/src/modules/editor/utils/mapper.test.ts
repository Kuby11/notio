import { describe, expect, it } from 'vitest';
import { toBlock, toBlockList } from './mapper';

const BLOCK_ID = '5c3d2e1f-0a9b-4c8d-9e7f-6a5b4c3d2e1f';
const PAGE_ID = '3f1f9b6e-6a4a-4c7e-9b2e-1f2c3d4e5f60';

function validBlock(): Record<string, unknown> {
  return {
    id: BLOCK_ID,
    pageId: PAGE_ID,
    type: 'paragraph',
    position: 'a0',
    content: { type: 'paragraph', content: 'Привет' },
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
}

describe('toBlock', () => {
  it('возвращает блок, прошедший валидацию', () => {
    const block = toBlock(validBlock());

    expect(block.id).toBe(BLOCK_ID);
    expect(block.content).toEqual({ type: 'paragraph', content: 'Привет' });
  });

  it('отклоняет неизвестный тип блока', () => {
    expect(() => toBlock({ ...validBlock(), type: 'table' })).toThrow();
  });

  it('отклоняет содержимое неподходящей формы', () => {
    expect(() => toBlock({ ...validBlock(), content: {} })).toThrow();
  });
});

describe('toBlockList', () => {
  it('разбирает постраничный ответ', () => {
    const result = toBlockList({ items: [validBlock()], nextCursor: null });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });
});
