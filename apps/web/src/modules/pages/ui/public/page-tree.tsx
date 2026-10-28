'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from 'cn';
import { usePages } from '../../hooks/use-pages';
import { PageActionsMenu } from '../private/page-actions-menu';
import { PageTreeStatus } from '../private/page-tree-status';
import type { Page } from '@notio/contracts';

interface PageTreeProps {
  workspaceId: string;
  parentId?: string | null;
  depth?: number;
}

/** The root-level "Add new" row: a muted pill, as in the Notion sidebar. */
const ADD_ROW_CLASS =
  'mt-0.5 flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-neutral-500 transition-colors hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100';

/**
 * Recursive page tree.
 *
 * The component is only responsible for UI: expanding nodes, data and operations
 * come from the single facade hook `usePages`. Store state
 * and network calls do not leak outside the component.
 */
export function PageTree({ workspaceId, parentId = null, depth = 0 }: PageTreeProps) {
  const t = useTranslations('sidebar');
  const router = useRouter();
  const { expanded, toggle, children, createPage } = usePages(workspaceId, parentId);

  if (children.isPending) {
    return <PageTreeStatus>{t('loading')}</PageTreeStatus>;
  }

  if (children.isError) {
    return <PageTreeStatus tone="error">{t('loadFailed')}</PageTreeStatus>;
  }

  const items = children.data ?? [];

  // Nested levels without children render nothing; the root level keeps its
  // empty state and the "Add new" row, so the first page can be created here.
  if (items.length === 0 && depth > 0) {
    return null;
  }

  async function addRootPage(): Promise<void> {
    const created = await createPage.mutateAsync({
      workspaceId,
      parentId: null,
      title: '',
    });

    router.push(`/workspaces/${workspaceId}/${created.id}`);
  }

  return (
    <>
      {items.length === 0 ? (
        <PageTreeStatus>{t('noPages')}</PageTreeStatus>
      ) : (
        <ul className="space-y-0.5" role="tree" aria-label={t('pages')}>
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
      )}

      {depth === 0 ? (
        <button
          type="button"
          disabled={createPage.isPending}
          onClick={() => {
            void addRootPage();
          }}
          className={ADD_ROW_CLASS}
        >
          <Plus className="size-4 shrink-0" aria-hidden="true" />
          {t('addNew')}
        </button>
      ) : null}
    </>
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
  const t = useTranslations('sidebar');
  const router = useRouter();
  const pathname = usePathname();
  const { children, createPage } = usePages(workspaceId, page.id, 'tree', {
    enabled: expanded,
  });
  const title = page.title || t('untitledFallback');
  // The row of the open page stays highlighted, as in the Notion sidebar.
  const active = pathname === `/workspaces/${workspaceId}/${page.id}`;
  const loadedChildren = children.data?.length ?? 0;
  // For a collapsed node we rely on hasChildren from the list. After
  // expanding — on actually loaded children: so the button doesn't disappear
  // while the request is in progress, and updates if data changes.
  const canExpand = expanded
    ? children.isPending || children.isError || loadedChildren > 0
    : (page.hasChildren ?? loadedChildren > 0);

  // While the page menu is open, controls must remain visible:
  // a hidden anchor causes Base UI to position the menu in the top-left
  // corner of the page (reported: menu jumped to corner on cursor leave).
  const [menuOpen, setMenuOpen] = useState(false);

  async function addChildPage(): Promise<void> {
    const created = await createPage.mutateAsync({
      workspaceId,
      parentId: page.id,
      title: '',
    });

    router.push(`/workspaces/${workspaceId}/${created.id}`);
  }

  return (
    <li
      role="treeitem"
      aria-expanded={canExpand ? expanded : undefined}
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      <div className="group flex items-center gap-0.5 rounded-md transition-colors hover:bg-neutral-100/80 dark:hover:bg-neutral-800/70">
        {canExpand ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? t('collapse', { title }) : t('expand', { title })}
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
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-sm',
            active
              ? 'bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
              : 'text-neutral-700 dark:text-neutral-300',
          )}
        >
          <span aria-hidden="true">{page.icon ?? '📄'}</span>
          <span className="truncate">{title}</span>
          {page.isFavorite ? <span aria-label={t('favorites')}>★</span> : null}
        </Link>
        {/* Кнопки появляются при наведении на строку дерева и остаются
            видимыми, пока открыто меню страницы. */}
        <div
          className={`mr-1 shrink-0 items-center gap-0.5 ${
            menuOpen ? 'flex' : 'hidden group-hover:flex'
          }`}
        >
          <button
            type="button"
            aria-label={t('newChildPage')}
            title={t('newChildPage')}
            disabled={createPage.isPending}
            onClick={() => {
              void addChildPage();
            }}
            className="rounded p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <PageActionsMenu page={page} workspaceId={workspaceId} onOpenChange={setMenuOpen} />
        </div>
      </div>
      {expanded && canExpand ? (
        <PageTree workspaceId={workspaceId} parentId={page.id} depth={depth + 1} />
      ) : null}
    </li>
  );
}
