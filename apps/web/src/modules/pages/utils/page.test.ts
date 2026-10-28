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
  it('sorts by position lexicographically', () => {
    const roots = sample.filter((page) => page.parentId === null);

    expect(sortPages(roots).map((page) => page.id)).toEqual(['root-a', 'root-b']);
  });
});

describe('buildTree', () => {
  it('builds nested tree from flat list', () => {
    const tree = buildTree(sample);

    expect(tree.map((node) => node.id)).toEqual(['root-a', 'root-b']);
    expect(tree[0]?.children.map((child) => child.id)).toEqual(['child-a1', 'child-a2']);
  });

  it('returns empty array for empty list', () => {
    expect(buildTree([])).toEqual([]);
  });
});

describe('findNode', () => {
  it('finds node at any level', () => {
    const tree = buildTree(sample);

    expect(findNode(tree, 'child-a2')?.title).toBe('A2');
    expect(findNode(tree, 'missing')).toBeNull();
  });
});

describe('canMove', () => {
  it('allows move to root and to another parent', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-b', null)).toBe(true);
    expect(canMove(tree, 'child-a1', 'root-b')).toBe(true);
  });

  it('forbids moving into itself', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-a', 'root-a')).toBe(false);
  });

  it('forbids moving into its own descendant', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-a', 'child-a1')).toBe(false);
  });

  it('allows moving to unknown parent (server decides)', () => {
    const tree = buildTree(sample);

    expect(canMove(tree, 'root-a', 'does-not-exist')).toBe(true);
  });
});

describe('moveInTree', () => {
  it('moves node without mutating original tree', () => {
    const tree = buildTree(sample);
    const moved = moveInTree(tree, 'child-a1', 'root-b', 'a0');

    expect(findNode(moved, 'child-a1')?.parentId).toBe('root-b');
    expect(findNode(tree, 'child-a1')?.parentId).toBe('root-a');
  });

  it('does not change tree if move forbidden', () => {
    const tree = buildTree(sample);
    const moved = moveInTree(tree, 'root-a', 'child-a1', 'a0');

    expect(moved).toEqual(tree);
  });
});

describe('normalizePageTitle', () => {
  it('trims whitespace', () => {
    expect(normalizePageTitle('  New  ')).toBe('New');
  });

  it('substitutes default title for empty string', () => {
    expect(normalizePageTitle('   ')).toBe('Untitled');
  });
});

describe('assertCanMove', () => {
  it('allows valid move', () => {
    const tree = buildTree(sample);

    expect(() => assertCanMove(tree, 'child-a1', 'root-b')).not.toThrow();
  });

  it('throws domain error for move into descendant', () => {
    const tree = buildTree(sample);

    expect(() => assertCanMove(tree, 'root-a', 'child-a1')).toThrow(/descendant/);
  });
});

describe('flattenTree', () => {
  it('flattens tree to a flat list without children', () => {
    const flat = flattenTree(buildTree(sample));

    expect(flat.map((page) => page.id)).toEqual(['root-a', 'child-a1', 'child-a2', 'root-b']);
    expect(flat.every((page) => !('children' in page))).toBe(true);
  });
});

describe('isPageId', () => {
  it('accepts UUID v4 and rejects garbage', () => {
    expect(isPageId('9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f')).toBe(true);
    expect(isPageId('page-1')).toBe(false);
    expect(isPageId('')).toBe(false);
  });

  it('rejects other UUID versions: page ids are always v4', () => {
    expect(isPageId('9f1c0e2a-3b4d-1c5e-8f90-1a2b3c4d5e6f')).toBe(false);
  });
});
