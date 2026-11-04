'use client';

import type { Database } from '@notio/contracts';
import { ChevronRight, Database as DatabaseIcon, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type ComponentProps } from 'react';
import { cn } from 'cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../shared/ui/dialog';
import { Button } from '../../../../shared/ui/button';
import { useDatabaseViews } from '../../hooks/use-database-views';
import { useWorkspaceDatabases } from '../../hooks/use-workspace-databases';

export interface DatabasesTreeProps {
  workspaceId: string;
  /** Page that owns these databases; null — workspace root. */
  parentId: string | null;
  /** Tree level, matching the sibling page rows' indentation. */
  depth?: number;
}

const ROW_CLASS =
  'flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-sm text-neutral-700 dark:text-neutral-300';

/**
 * Database rows of one tree level.
 *
 * The component returns `<li>` items for the pages tree's `<ul>`: databases
 * created inside a page sit next to that page's child pages, and root-level
 * databases sit next to root pages. Every database expands into its views,
 * just like a page expands into child pages.
 */
export function DatabasesTree({ workspaceId, parentId, depth = 0 }: DatabasesTreeProps) {
  const t = useTranslations('databases.tree');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const { items, deleteDatabase } = useWorkspaceDatabases(workspaceId);
  const [deleting, setDeleting] = useState<Database | null>(null);
  const [deleteError, setDeleteError] = useState(false);

  const levelItems = items.filter((database) => (database.parentId ?? null) === parentId);

  async function confirmDelete(): Promise<void> {
    if (!deleting) {
      return;
    }

    setDeleteError(false);

    try {
      await deleteDatabase.mutateAsync(deleting.id);

      if (pathname === `/workspaces/${workspaceId}/databases/${deleting.id}`) {
        router.push(`/workspaces/${workspaceId}`);
      }

      setDeleting(null);
    } catch {
      setDeleteError(true);
    }
  }

  // Nothing to show, and no dialog to keep open: the tree stays compact.
  if (levelItems.length === 0 && deleting === null) {
    return null;
  }

  return (
    <>
      {levelItems.map((database) => (
        <DatabaseTreeRow
          key={database.id}
          database={database}
          workspaceId={workspaceId}
          depth={depth}
          active={pathname === `/workspaces/${workspaceId}/databases/${database.id}`}
          onDelete={() => {
            setDeleteError(false);
            setDeleting(database);
          }}
        />
      ))}

      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setDeleteError(false);
          }
        }}
      >
        {deleting !== null ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteTitle')}</DialogTitle>
              <DialogDescription>
                {t('deleteDescription', { title: deleting.title || t('untitled') })}
              </DialogDescription>
            </DialogHeader>

            {deleteError ? (
              <p className="text-sm text-destructive" role="alert">
                {t('deleteFailed')}
              </p>
            ) : null}

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                {tCommon('cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={deleteDatabase.isPending}
                onClick={() => {
                  void confirmDelete();
                }}
              >
                <Trash2 aria-hidden="true" />
                {deleteDatabase.isPending ? t('deleting') : t('deleteConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function DatabaseTreeRow({
  database,
  workspaceId,
  depth,
  active,
  onDelete,
}: {
  database: Database;
  workspaceId: string;
  depth: number;
  active: boolean;
  onDelete: () => void;
}) {
  const t = useTranslations('databases.tree');
  const [expanded, setExpanded] = useState(active);
  const viewsQuery = useDatabaseViews(database.id, expanded);
  const title = database.title || t('untitled');
  const views = viewsQuery.data ?? [];
  const canExpand = Boolean(database.defaultViewId) || views.length > 0;
  const href = (
    database.defaultViewId
      ? `/workspaces/${workspaceId}/databases/${database.id}?view=${database.defaultViewId}`
      : `/workspaces/${workspaceId}/databases/${database.id}`
  ) as ComponentProps<typeof Link>['href'];

  useEffect(() => {
    if (active) {
      setExpanded(true);
    }
  }, [active]);

  return (
    <li aria-expanded={canExpand ? expanded : undefined} style={{ paddingLeft: `${depth * 12}px` }}>
      <div className="group flex items-center gap-0.5 rounded-md transition-colors hover:bg-neutral-100/80 dark:hover:bg-neutral-800/70">
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? t('collapse', { title }) : t('expand', { title })}
            className="shrink-0 rounded p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <ChevronRight
              aria-hidden="true"
              className={cn('h-4 w-4 transition-transform', expanded && 'rotate-90')}
            />
          </button>
        ) : (
          <span className="h-6 w-6 shrink-0" aria-hidden="true" />
        )}

        <Link
          href={href}
          aria-current={active ? 'page' : undefined}
          className={cn(
            ROW_CLASS,
            active
              ? 'bg-neutral-200 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
              : '',
          )}
        >
          <DatabaseIcon
            className="size-4 shrink-0 text-neutral-500 dark:text-neutral-400"
            aria-hidden="true"
          />
          <span className="truncate">{title}</span>
        </Link>

        <button
          type="button"
          aria-label={t('deleteAria', { title })}
          title={t('deleteAria', { title })}
          onClick={onDelete}
          className="mr-1 shrink-0 rounded p-1 text-neutral-500 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
        </button>
      </div>

      {expanded && views.length > 0 ? (
        <ul className="space-y-0.5 pl-5" aria-label={t('viewsLabel', { title })}>
          {views.map((view) => (
            <li key={view.id}>
              <Link
                href={`/workspaces/${workspaceId}/databases/${database.id}?view=${view.id}`}
                className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100"
              >
                <span
                  className="size-1 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-500"
                  aria-hidden="true"
                />
                <span className="truncate">{view.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
