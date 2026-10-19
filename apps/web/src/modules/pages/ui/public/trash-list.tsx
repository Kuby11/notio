'use client';

import { RotateCcw } from 'lucide-react';
import { usePages } from '../../hooks/use-pages';
import { DEFAULT_PAGE_TITLE } from '../../utils/page';
import { PageTreeStatus } from '../private/page-tree-status';

interface TrashListProps {
  workspaceId: string;
}

/**
 * Удалённые страницы всего рабочего пространства.
 *
 * Плоский список, как и избранное: родитель удалённой страницы может сам
 * лежать в корзине. Восстановление возвращает страницу на прежнее место
 * в дереве, поэтому после мутации инвалидируется весь кеш workspace.
 */
export function TrashList({ workspaceId }: TrashListProps) {
  const { trash, restorePage } = usePages(workspaceId, null, 'trash');

  if (trash.isPending) {
    return <PageTreeStatus>Загрузка…</PageTreeStatus>;
  }

  if (trash.isError) {
    return <PageTreeStatus tone="error">Не удалось загрузить корзину</PageTreeStatus>;
  }

  const items = trash.data ?? [];

  if (items.length === 0) {
    return <PageTreeStatus>Корзина пуста</PageTreeStatus>;
  }

  return (
    <ul className="space-y-1" aria-label="Удалённые страницы">
      {items.map((page) => {
        const title = page.title || DEFAULT_PAGE_TITLE;

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
              aria-label={`Восстановить «${title}»`}
              title="Восстановить"
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
