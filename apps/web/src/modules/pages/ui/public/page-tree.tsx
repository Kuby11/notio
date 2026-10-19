'use client';

import { usePages } from '../../hooks/use-pages';
import { PageTreeStatus } from '../private/page-tree-status';
import type { Page } from '@notio/contracts';

interface PageTreeProps {
  workspaceId: string;
  parentId?: string | null;
  depth?: number;
}

/**
 * Рекурсивное дерево страниц.
 *
 * Компонент отвечает только за UI: раскрытие узлов, данные и операции
 * приходят из единственного facade-хука `usePages`. Состояние стора
 * и сетевые вызовы наружу из компонента не протекают.
 */
export function PageTree({ workspaceId, parentId = null, depth = 0 }: PageTreeProps) {
  const { expanded, toggle, children } = usePages(workspaceId, parentId);

  if (children.isPending) {
    return <PageTreeStatus>Загрузка…</PageTreeStatus>;
  }

  if (children.isError) {
    return <PageTreeStatus tone="error">Не удалось загрузить страницы</PageTreeStatus>;
  }

  const items = children.data ?? [];

  if (items.length === 0) {
    return depth === 0 ? <PageTreeStatus>Нет страниц</PageTreeStatus> : null;
  }

  return (
    <ul className="space-y-0.5" role="tree" aria-label="Страницы">
      {items.map((page) => (
        <PageTreeNode
          key={page.id}
          page={page}
          workspaceId={workspaceId}
          depth={depth}
          expanded={expanded[page.id] ?? false}
          onToggle={() => toggle(page.id)}
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
  onToggle: () => void;
}

function PageTreeNode({ page, workspaceId, depth, expanded, onToggle }: PageTreeNodeProps) {
  const { children } = usePages(workspaceId, page.id);

  return (
    <li role="treeitem" aria-expanded={expanded} style={{ paddingLeft: `${depth * 12}px` }}>
      <button
        type="button"
        onClick={onToggle}
        onMouseEnter={() => void children.refetch()}
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
