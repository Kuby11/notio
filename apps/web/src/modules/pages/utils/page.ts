/**
 * Доменные правила страниц.
 *
 * Чистый TypeScript без React, Zod и сети. Порядок и циклы проверяются здесь,
 * а не в компонентах: иначе один и тот же инвариант жил бы в трёх местах.
 */
import type { Page } from '@notio/contracts';
import { IdSchema } from '@notio/contracts';

export type PageNode = Page & { children: PageNode[] };

/** Заголовок страницы по умолчанию: пустая строка в интерфейсе не читается. */
export const DEFAULT_PAGE_TITLE = 'Без названия';

/** Обрезает пробелы и подставляет заголовок по умолчанию вместо пустого. */
export function normalizePageTitle(title: string): string {
  const trimmed = title.trim();

  return trimmed.length === 0 ? DEFAULT_PAGE_TITLE : trimmed;
}

/** Сортирует страницы по position (fractional indexing, лексикографически). */
export function sortPages(pages: readonly Page[]): Page[] {
  return [...pages].toSorted((left, right) => left.position.localeCompare(right.position));
}

/** Строит дерево из плоского списка: корень — parentId === null. */
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

/** Ищет узел по id в дереве. */
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
 * Проверка цикла: нельзя переместить страницу внутрь самой себя или
 * внутрь собственного потомка. Возвращает true, если перемещение возможно.
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
 * Проверка перемещения с доменной ошибкой.
 *
 * Цикл проверяется на клиенте до запроса: иначе пользователь ждал бы сетевой
 * ответ, чтобы узнать, что действие запрещено. Сервер всё равно проверяет
 * повторно — клиент не источник истины.
 */
export function assertCanMove(
  tree: readonly PageNode[],
  pageId: string,
  newParentId: string | null,
): void {
  if (!canMove(tree, pageId, newParentId)) {
    throw new Error('Нельзя переместить страницу внутрь собственного потомка');
  }
}

/** Оптимистичное перемещение: возвращает новое дерево без мутации исходного. */
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

/** Плоский список узлов дерева: удобно для поиска и фильтрации. */
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

/** Проверка, что id корректный UUID: общее правило для всего дерева. */
export function isPageId(value: string): boolean {
  return IdSchema.safeParse(value).success;
}
