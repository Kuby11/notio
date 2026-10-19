import { describe, expect, it } from 'vitest';
import { toPage, toPageList } from './mapper';

const PAGE_ID = '3f1f9b6e-6a4a-4c7e-9b2e-1f2c3d4e5f60';
const WORKSPACE_ID = '2b2b6f1c-1a2b-4c3d-8e4f-5a6b7c8d9e0f';
const USER_ID = '9d8c7b6a-5e4f-4321-8abc-def012345678';

function validPage(): Record<string, unknown> {
  return {
    id: PAGE_ID,
    workspaceId: WORKSPACE_ID,
    parentId: null,
    title: 'Заметка',
    position: 'a0',
    isFavorite: false,
    isTrashed: false,
    createdBy: USER_ID,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
}

describe('toPage', () => {
  it('возвращает страницу, прошедшую валидацию', () => {
    const page = toPage(validPage());

    expect(page.id).toBe(PAGE_ID);
    expect(page.title).toBe('Заметка');
  });

  it('отклоняет ответ с некорректным id', () => {
    expect(() => toPage({ ...validPage(), id: 'page-1' })).toThrow();
  });

  it('отклоняет ответ без обязательных полей', () => {
    expect(() => toPage({ id: PAGE_ID })).toThrow();
  });
});

describe('toPageList', () => {
  it('разбирает постраничный ответ', () => {
    const result = toPageList({ items: [validPage()], nextCursor: null });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('отклоняет ответ, где items не массив', () => {
    expect(() => toPageList({ items: 'нет', nextCursor: null })).toThrow();
  });
});
