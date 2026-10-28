/**
 * Domain rules for pages.
 *
 * Pure TypeScript without React, Zod, or network. Ordering and cycles are checked here
 * rather than in components: otherwise the same invariant would live in three places.
 */
import type { Page } from '@notio/contracts';
import { IdSchema } from '@notio/contracts';

export type PageNode = Page & { children: PageNode[] };

/** Default page title: an empty string in the interface is not readable. */
export const DEFAULT_PAGE_TITLE = 'Untitled';

/**
 * Trims whitespace and substitutes the default title for empty strings.
 * The UI passes a localized fallback: the title is saved to the document,
 * so "Untitled" must not appear in the English interface.
 */
export function normalizePageTitle(title: string, fallback: string = DEFAULT_PAGE_TITLE): string {
  const trimmed = title.trim();

  return trimmed.length === 0 ? fallback : trimmed;
}

/** Sorts pages by position (fractional indexing, lexicographically). */
export function sortPages(pages: readonly Page[]): Page[] {
  return [...pages].toSorted((left, right) => left.position.localeCompare(right.position));
}

/** Builds a tree from a flat list: root has parentId === null. */
export function buildTree(pages: readonly Page[]): PageNode[] {
  const byParent = new Map<string | null, Page[]>();

  for (const page of pages) {
    const siblings = byParent.get(page.parentId) ?? [];
    siblings.push(page);
    byParent.set(page.parentId, siblings);
  }

  function build(parentId: string | null): PageNode[] {
    return sortPages(byParent.get(parentId) ?? []).map((page) => ({
      ...page,
      children: build(page.id),
    }));
  }

  return build(null);
}

/** Finds a node by id in the tree. */
export function findNode(nodes: readonly PageNode[], id: string): PageNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const found = findNode(node.children, id);

    if (found !== null) {
      return found;
    }
  }

  return null;
}

/**
 * Cycle check: cannot move a page inside itself or inside its own descendant.
 * Returns true if the move is possible.
 */
export function canMove(
  tree: readonly PageNode[],
  pageId: string,
  newParentId: string | null,
): boolean {
  if (newParentId === null) {
    return pageId !== newParentId;
  }

  if (pageId === newParentId) {
    return false;
  }

  const subtree = findNode(tree, pageId);

  if (subtree === null) {
    return true;
  }

  return findNode(subtree.children, newParentId) === null;
}

/**
 * Move validation with domain error.
 *
 * The cycle is checked on the client before the request: otherwise the user would wait for a network
 * response to find out the action is forbidden. The server still checks
 * again — the client is not the source of truth.
 */
export function assertCanMove(
  tree: readonly PageNode[],
  pageId: string,
  newParentId: string | null,
): void {
  if (!canMove(tree, pageId, newParentId)) {
    throw new Error('Cannot move a page inside its own descendant');
  }
}

/** Optimistic move: returns a new tree without mutating the original. */
export function moveInTree(
  tree: readonly PageNode[],
  pageId: string,
  newParentId: string | null,
  newPosition: string,
): PageNode[] {
  const node = findNode(tree, pageId);

  if (node === null || !canMove(tree, pageId, newParentId)) {
    return [...tree];
  }

  const without = removeNode(tree, pageId);
  const moved: PageNode = { ...node, parentId: newParentId, position: newPosition };

  return insertNode(without, moved, newParentId);
}

function removeNode(nodes: readonly PageNode[], id: string): PageNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({ ...node, children: removeNode(node.children, id) }));
}

function insertNode(
  nodes: readonly PageNode[],
  node: PageNode,
  parentId: string | null,
): PageNode[] {
  if (parentId === null) {
    return [...nodes, node]
      .toSorted((left, right) => left.position.localeCompare(right.position))
      .map((entry) => ({
        ...entry,
        children: [...entry.children],
      }));
  }

  return nodes.map((entry) => {
    if (entry.id === parentId) {
      return { ...entry, children: sortPages([...entry.children, node]) } as PageNode;
    }

    return { ...entry, children: insertNode(entry.children, node, parentId) };
  });
}

/** Flat list of tree nodes: convenient for search and filtering. */
export function flattenTree(nodes: readonly PageNode[]): Page[] {
  const result: Page[] = [];

  function visit(node: PageNode): void {
    const { children, ...page } = node;

    result.push(page);
    children.forEach(visit);
  }

  nodes.forEach(visit);

  return result;
}

/** Check that id is a valid UUID: common rule for the whole tree. */
export function isPageId(value: string): boolean {
  return IdSchema.safeParse(value).success;
}
