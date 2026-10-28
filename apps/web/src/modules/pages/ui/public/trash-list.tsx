'use client';

import { RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePages } from '../../hooks/use-pages';
import { PageTreeStatus } from '../private/page-tree-status';

interface TrashListProps {
  workspaceId: string;
}

/**
 * Deleted pages across the entire workspace.
 *
 * Flat list like favorites: the parent of a deleted page may itself
 * be in the trash. Restoration returns the page to its previous place
 * in the tree, so after mutation the entire workspace cache is invalidated.
 */
export function TrashList({ workspaceId }: TrashListProps) {
  const t = useTranslations('pages.trash');
  const tCommon = useTranslations('common');
  const { trash, restorePage } = usePages(workspaceId, null, 'trash');

  if (trash.isPending) {
    return <PageTreeStatus>{t('trashLoading')}</PageTreeStatus>;
  }

  if (trash.isError) {
    return <PageTreeStatus tone="error">{t('trashLoadFailed')}</PageTreeStatus>;
  }

  const items = trash.data ?? [];

  if (items.length === 0) {
    return <PageTreeStatus>{t('empty')}</PageTreeStatus>;
  }

  return (
    <ul className="space-y-1" aria-label={t('list')}>
      {items.map((page) => {
        const title = page.title || tCommon('untitled');

        return (
          <li key={page.id} className="flex items-center gap-2">
            <span aria-hidden="true" className="pl-2">
              {page.icon ?? '📄'}
            </span>
            <span className="min-w-0 flex-1 truncate px-0.5 text-sm">{title}</span>
            <button
              type="button"
              onClick={() => restorePage.mutate({ id: page.id, workspaceId })}
              disabled={restorePage.isPending}
              aria-label={t('restore', { title })}
              title={t('restore', { title })}
              className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
