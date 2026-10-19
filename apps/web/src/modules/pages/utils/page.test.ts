import { describe, expect, it } from 'vitest';
import {
  assertCanMove,
  buildTree,
  canMove,
  findNode,
  flattenTree,
  isPageId,
  moveInTree,
  normalizePageTitle,
  sortPages,
} from './page';

const sample = [
  {
    id: 'root-a',
    workspaceId: 'ws',
    parentId: null,
    title: 'A',
    position: 'a0',
    isFavorite: false,
    isTrashed: false,
    createdBy: 'u',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'child-a1',
    workspaceId: 'ws',
    parentId: 'root-a',
    title: 'A1',
    position: 'a0',
    isFavorite: false,
    isTrashed: false,
    createdBy: 'u',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'child-a2',
    workspaceId: 'ws',
    parentId: 'root-a',
    title: 'A2',
    position: 'a1',
    isFavorite: false,
    isTrashed: false,
    createdBy: 'u',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  },
  {
    id: 'root-b',
    workspaceId: 'ws',
    parentId: null,
    title: 'B',
    position: 'a1',
    isFavorite: false,
    isTrashed: false,
    createdBy: 'u',
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  },
];

describe('sortPages', () => {
  it('сортирует по position лексикографически', () => {
    const roots = sample.filter((page) => page.parentId === null);

    expect(sortPages(roots).map((page) => page.id)).toEqual(['root-a', 'root-b']);
  });
});

describe('buildTree', () => {
  it('строит вложенное дерево из плоского списка', () => {
    const tree = buildTree(sample);

    expect(tree.map((node) => node.id)).toEqual(['root-a', 'root-b']);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(['child-a1', 'child-a2']);
  });

  it('возвращает пустой массив для пустого списка', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('findNode', () => {
  it('находит узел на любом уровне', () => {
    const tree = buildTree(sample);

    expect(findNode(tree, 'child-a2')?.title).toBe('A2');
    expect(findNode(tree, 'missing')).toBeNull();
  });
});

describe('canMove', () => {
  it('разрешает перемещение в корень и к чужому родителю', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-b', null)).toBe(true);
    expect(canMove(tree, 'child-a1', 'root-b')).toBe(true);
  });

  it('запрещает перемещение внутрь самого себя', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-a', 'root-a')).toBe(false);
  });

  it('запрещает перемещение внутрь собственного потомка', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-a', 'child-a1')).toBe(false);
  });

  it('разрешает перемещение к неизвестному родителю (сервер решит)', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-a', 'does-not-exist')).toBe(true);
  });
});

describe('moveInTree', () => {
  it('перемещает узел без мутации исходного дерева', () => {
    const tree = buildTree(sample);
    const moved = moveInTree(tree, 'child-a1', 'root-b', 'a0');

    expect(findNode(moved, 'child-a1')?.parentId).toBe('root-b');
    expect(findNode(tree, 'child-a1')?.parentId).toBe('root-a');
  });

  it('не меняет дерево, если перемещение запрещено', () => {
    const tree = buildTree(sample);
    const moved = moveInTree(tree, 'root-a', 'child-a1', 'a0');

    expect(moved).toEqual(tree);
  });
});

describe('normalizePageTitle', () => {
  it('обрезает пробелы', () => {
    expect(normalizePageTitle('  Новая  ')).toBe('Новая');
  });

  it('подставляет заголовок по умолчанию для пустой строки', () => {
    expect(normalizePageTitle('   ')).toBe('Без названия');
  });
});

describe('assertCanMove', () => {
  it('пропускает допустимое перемещение', () => {
    const tree = buildTree(sample);

    expect(() => assertCanMove(tree, 'child-a1', 'root-b')).not.toThrow();
  });

  it('бросает доменную ошибку для перемещения внутрь потомка', () => {
    const tree = buildTree(sample);

    expect(() => assertCanMove(tree, 'root-a', 'child-a1')).toThrow(/потомка/);
  });
});

describe('flattenTree', () => {
  it('разворачивает дерево в плоский список без children', () => {
    const flat = flattenTree(buildTree(sample));

    expect(flat.map((page) => page.id)).toEqual(['root-a', 'child-a1', 'child-a2', 'root-b']);
    expect(flat.every((page) => !('children' in page))).toBe(true);
  });
});

describe('isPageId', () => {
  it('принимает UUID v4 и отклоняет мусор', () => {
    expect(isPageId('9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f')).toBe(true);
    expect(isPageId('page-1')).toBe(false);
    expect(isPageId('')).toBe(false);
  });

  it('отклоняет UUID другой версии: id страниц всегда v4', () => {
    expect(isPageId('9f1c0e2a-3b4d-1c5e-8f90-1a2b3c4d5e6f')).toBe(false);
  });
});
