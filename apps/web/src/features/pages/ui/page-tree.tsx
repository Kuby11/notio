'use client';

import { usePageChildren } from './use-pages';
import { usePageTreeStore } from './page-tree.store';
import type { Page } from '@notio/contracts';

interface PageTreeProps {
  workspaceId: string;
  parentId?: string | null;
  depth?: number;
}

/**
 * Рекурсивное дерево страниц.
 *
 * Ленивая загрузка: дети запрашиваются только для развёрнутых узлов.
 * Prefetch на hover — чтобы раскрытие было мгновенным.
 */
export function PageTree({ workspaceId, parentId = null, depth = 0 }: PageTreeProps) {
  const expanded = usePageTreeStore((state) => state.expanded);
  const children = usePageChildren(workspaceId, parentId);

  if (children.isPending) {
    return <p className="px-2 py-1 text-xs text-neutral-400">Загрузка…</p>;
  }

  if (children.isError) {
    return <p className="px-2 py-1 text-xs text-red-600">Не удалось загрузить страницы</p>;
  }

  const items = children.data ?? [];

  if (items.length === 0) {
    return <p className="px-2 py-1 text-xs text-neutral-400">Нет страниц</p>;
  }

  return (
    <ul className="space-y-0.5" role="tree" aria-label="Страницы">
      {items.map((page: { id: string }) => (
        <PageTreeNode
          key={page.id}
          page={page as never}
          workspaceId={workspaceId}
          depth={depth}
          expanded={expanded[page.id] ?? false}
        />
      ))}
    </ul>
  );
}

interface PageTreeNodeProps {
  page: Page;
  workspaceId: string;
  depth: number;
  expanded: boolean;
}

function PageTreeNode({ page, workspaceId, depth, expanded }: PageTreeNodeProps) {
  const toggle = usePageTreeStore((state) => state.toggle);
  const prefetch = usePageChildren(workspaceId, page.id);

  return (
    <li role="treeitem" aria-expanded={expanded} style={{ paddingLeft: `${depth * 12}px` }}>
      <button
        type="button"
        onClick={() => toggle(page.id)}
        onMouseEnter={() => void prefetch.refetch()}
        className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
      >
        <span aria-hidden="true">{page.icon ?? '📄'}</span>
        <span className="truncate">{page.title || 'Без названия'}</span>
        {page.isFavorite ? <span aria-label="Избранное">★</span> : null}
      </button>
      {expanded ? (
        <PageTree workspaceId={workspaceId} parentId={page.id} depth={depth + 1} />
      ) : null}
    </li>
  );
}
