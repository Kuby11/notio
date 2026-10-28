'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  ChevronRight,
  Clock,
  Eye,
  Files,
  Lock,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from 'cn';
import type { Page } from '@notio/contracts';
import { Avatar } from '../avatar';

/** Columns the display menu can hide. The page name is always shown. */
export type LibraryColumn = 'createdBy' | 'source' | 'lastEdited' | 'lastVisited';

export const LIBRARY_COLUMNS: readonly LibraryColumn[] = [
  'createdBy',
  'source',
  'lastEdited',
  'lastVisited',
];

/** One icon per column: the table header and the display menu share them. */
export const COLUMN_ICONS: Record<LibraryColumn | 'name', LucideIcon> = {
  name: Files,
  createdBy: UserRound,
  source: ArrowUpRight,
  lastEdited: Clock,
  lastVisited: Eye,
};

interface LibraryRowProps {
  workspaceId: string;
  page: Page;
  /** Nesting level: the name cell is indented by it. */
  depth: number;
  parent: Page | undefined;
  creatorName: string | null;
  visitedAt: string | null;
  /** Columns currently visible; a hidden column renders no cell. */
  visible: ReadonlySet<LibraryColumn>;
  expandable: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Relative time formatter built once by the table (locale-aware). */
  formatTime: (iso: string) => string;
}

/**
 * One row of the library table.
 *
 * The row is presentational: filters, expansion state and data come from
 * `LibraryView`. Nesting is expressed by indenting the name cell instead of
 * nesting tables — a page's children may be filtered out independently.
 */
export function LibraryRow({
  workspaceId,
  page,
  depth,
  parent,
  creatorName,
  visitedAt,
  visible,
  expandable,
  expanded,
  onToggle,
  formatTime,
}: LibraryRowProps) {
  const t = useTranslations('library');
  const tCommon = useTranslations('common');
  const title = page.title || tCommon('untitled');

  return (
    <tr className="group border-t border-border/50 transition-colors hover:bg-muted/40">
      <td className="py-0">
        <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
          {expandable ? (
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={expanded}
              aria-label={expanded ? t('collapse', { title }) : t('expand', { title })}
              className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ChevronRight
                aria-hidden="true"
                className={cn('size-3.5 transition-transform', expanded && 'rotate-90')}
              />
            </button>
          ) : (
            <span className="size-5 shrink-0" aria-hidden="true" />
          )}
          <Link
            href={`/workspaces/${workspaceId}/${page.id}`}
            className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-sm text-foreground"
          >
            <span aria-hidden="true" className="shrink-0">
              {page.icon ?? '📄'}
            </span>
            <span className="truncate">{title}</span>
            {page.isFavorite ? (
              <span className="text-amber-500" aria-label={t('tabs.favorites')}>
                ★
              </span>
            ) : null}
          </Link>
        </div>
      </td>

      {visible.has('createdBy') ? (
        <td className="py-1.5 pr-2">
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            {creatorName !== null ? (
              <>
                <Avatar name={creatorName} size="xs" />
                <span className="truncate">{creatorName}</span>
              </>
            ) : (
              <span aria-hidden="true">—</span>
            )}
          </span>
        </td>
      ) : null}

      {visible.has('source') ? (
        <td className="py-1.5 pr-2">
          {parent !== undefined ? (
            <Link
              href={`/workspaces/${workspaceId}/${parent.id}`}
              className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <span aria-hidden="true">{parent.icon ?? '📄'}</span>
              <span className="truncate">{parent.title || tCommon('untitled')}</span>
            </Link>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Lock className="size-3.5 shrink-0" aria-hidden="true" />
              {t('sourcePrivate')}
            </span>
          )}
        </td>
      ) : null}

      {visible.has('lastEdited') ? (
        <td className="py-1.5 pr-2 text-sm whitespace-nowrap text-muted-foreground">
          {formatTime(page.updatedAt)}
        </td>
      ) : null}

      {visible.has('lastVisited') ? (
        <td className="py-1.5 pr-2 text-sm whitespace-nowrap text-muted-foreground">
          {visitedAt !== null ? formatTime(visitedAt) : <span aria-hidden="true">—</span>}
        </td>
      ) : null}
    </tr>
  );
}
