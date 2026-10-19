'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { usePages } from '../../hooks/use-pages';
import { DEFAULT_PAGE_TITLE } from '../../utils/page';
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
  const title = page.title || DEFAULT_PAGE_TITLE;
  // Пока дети не загрузились, иконку раскрытия показываем: иначе она
  // появится уже после того, как пользователь попробует раскрыть узел.
  const canExpand = children.isPending || children.isError || (children.data?.length ?? 0) > 0;

  return (
    <li
      role="treeitem"
      aria-expanded={canExpand ? expanded : undefined}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      <div className="flex items-center gap-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
        {canExpand ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={`${expanded ? 'Свернуть' : 'Развернуть'} «${title}»`}
            className="shrink-0 rounded p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <ChevronRight
              aria-hidden="true"
              className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}
        <Link
          href={`/workspaces/${workspaceId}/${page.id}`}
          onMouseEnter={canExpand ? () => void children.refetch() : undefined}
          className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-sm"
        >
          <span aria-hidden="true">{page.icon ?? '📄'}</span>
          <span className="truncate">{title}</span>
          {page.isFavorite ? <span aria-label="Избранное">★</span> : null}
        </Link>
      </div>
      {expanded && canExpand ? (
        <PageTree workspaceId={workspaceId} parentId={page.id} depth={depth + 1} />
      ) : null}
    </li>
  );
}
