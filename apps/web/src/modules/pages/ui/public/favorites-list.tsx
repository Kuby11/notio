'use client';

import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePages } from '../../hooks/use-pages';
import { PageTreeStatus } from '../private/page-tree-status';

interface FavoritesListProps {
  workspaceId: string;
}

/**
 * Favorite pages across the entire workspace.
 *
 * The component only displays a flat list: data and un-favoriting
 * come from the facade hook `usePages` with `scope: 'favorites'`. Nesting
 * is not needed here — favorites intentionally do not repeat the tree.
 */
export function FavoritesList({ workspaceId }: FavoritesListProps) {
  const t = useTranslations('pages.favorites');
  const tCommon = useTranslations('common');
  const { favorites, toggleFavorite } = usePages(workspaceId, null, 'favorites');

  if (favorites.isPending) {
    return <PageTreeStatus>{t('favoritesLoading')}</PageTreeStatus>;
  }

  if (favorites.isError) {
    return <PageTreeStatus tone="error">{t('favoritesLoadFailed')}</PageTreeStatus>;
  }

  const items = favorites.data ?? [];

  if (items.length === 0) {
    return <PageTreeStatus>{t('empty')}</PageTreeStatus>;
  }

  return (
    <ul className="space-y-1" aria-label={t('list')}>
      {items.map((page) => {
        const title = page.title || tCommon('untitled');

        return (
          <li key={page.id} className="flex items-center gap-2">
            <a
              href={`/workspaces/${workspaceId}/${page.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <span aria-hidden="true">{page.icon ?? '📄'}</span>
              <span className="truncate">{title}</span>
            </a>
            <button
              type="button"
              onClick={() => toggleFavorite.mutate({ id: page.id, workspaceId, isFavorite: false })}
              disabled={toggleFavorite.isPending}
              aria-label={t('favoritesRemoveFrom', { title })}
              className="rounded p-1.5 text-amber-500 hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-800"
            >
              <Star className="h-4 w-4 fill-current" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
