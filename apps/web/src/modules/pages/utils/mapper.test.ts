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
    title: 'Note',
    position: 'a0',
    isFavorite: false,
    isTrashed: false,
    createdBy: USER_ID,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
}

describe('toPage', () => {
  it('returns a page that passes validation', () => {
    const page = toPage(validPage());

    expect(page.id).toBe(PAGE_ID);
    expect(page.title).toBe('Note');
  });

  it('rejects a response with an invalid id', () => {
    expect(() => toPage({ ...validPage(), id: 'page-1' })).toThrow();
  });

  it('rejects a response without required fields', () => {
    expect(() => toPage({ id: PAGE_ID })).toThrow();
  });
});

describe('toPageList', () => {
  it('parses a paginated response', () => {
    const result = toPageList({ items: [validPage()], nextCursor: null });

    expect(result.items).toHaveLength(1);
    expect(result.nextCursor).toBeNull();
  });

  it('rejects a response where items is not an array', () => {
    expect(() => toPageList({ items: 'nope', nextCursor: null })).toThrow();
  });
});
