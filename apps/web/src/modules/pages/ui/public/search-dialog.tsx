'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, Plus, Search, Type, User, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { formatDate } from '@/core/preferences/preferences';
import { usePreferences } from '@/core/preferences/preferences.store';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/dialog';
import type { Page } from '@notio/contracts';
import { usePages } from '../../hooks/use-pages';
import { editedAgo } from '../../utils/time-ago';

interface SearchDialogProps {
  workspaceId: string;
  /** Whether the modal is open. */
  open: boolean;
  /** Query seeded from the sidebar input when the modal opens. */
  initialQuery: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Search categories from the reference design. Only `pages` is implemented:
 * the rest render as disabled chips so the scope of the current search is
 * visible without promising a filter that does not work yet.
 */
const CATEGORIES = [
  { id: 'pages', icon: null },
  { id: 'chats', icon: null },
  { id: 'titleOnly', icon: Type },
  { id: 'createdBy', icon: User },
  { id: 'in', icon: FileText },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

const ACTIVE_CATEGORY: CategoryId = 'pages';

const CHIP_CLASS =
  'inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors';

/** Requests are debounced so fast typing does not fire one query per keystroke. */
const SEARCH_DEBOUNCE_MS = 200;

/**
 * Workspace page search modal.
 *
 * Opened by submitting the sidebar search input: the submitted text is seeded
 * as `initialQuery`, and the user can keep editing it inside the modal. The
 * data comes from the module facade (`usePages` with `scope: 'search'`); the
 * component only maps results to rows and navigates on click.
 */
export function SearchDialog({ workspaceId, open, initialQuery, onOpenChange }: SearchDialogProps) {
  const t = useTranslations('search');
  const tCommon = useTranslations('common');
  const tHeader = useTranslations('pages.header');
  const locale = useLocale();
  const preferences = usePreferences();
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);

  // Each open re-seeds from the sidebar submission.
  useEffect(() => {
    if (open) {
      setText(initialQuery);
      setDebounced(initialQuery);
    }
  }, [open, initialQuery]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const query = debounced.trim();
  const { search } = usePages(workspaceId, null, 'search', { q: query, enabled: open });
  const results = search.data ?? [];

  function openPage(page: Page): void {
    onOpenChange(false);
    router.push(`/workspaces/${workspaceId}/${page.id}`);
  }

  // Time units are translated here: the utility returns a structure.
  function agoText(iso: string): string {
    const ago = editedAgo(iso);

    if (ago === null) {
      return '';
    }

    switch (ago.unit) {
      case 'now':
        return tHeader('justNow');
      case 'minutes':
        return tHeader('minutesAgo', { count: ago.value });
      case 'hours':
        return tHeader('hoursAgo', { count: ago.value });
      case 'days':
        return tHeader('daysAgo', { count: ago.value });
      default:
        return formatDate(ago.value, preferences, locale);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-2xl" initialFocus={inputRef}>
        <DialogTitle className="sr-only">{t('title')}</DialogTitle>

        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3 pr-10 dark:border-neutral-800">
          <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          <input
            ref={inputRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={t('placeholder')}
            aria-label={t('placeholder')}
            className="h-7 w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200 px-3 py-2 dark:border-neutral-800">
          {CATEGORIES.map((category, index) => {
            const Icon: LucideIcon | null = category.icon;
            const isActive = category.id === ACTIVE_CATEGORY;

            return (
              <span key={category.id} className="contents">
                {index === 2 ? (
                  <span
                    className="mx-1 h-4 w-px bg-neutral-200 dark:bg-neutral-700"
                    aria-hidden="true"
                  />
                ) : null}
                <button
                  type="button"
                  disabled={!isActive}
                  aria-pressed={isActive}
                  className={cn(
                    CHIP_CLASS,
                    isActive
                      ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                      : 'cursor-not-allowed text-neutral-400 disabled:opacity-70 dark:text-neutral-500',
                  )}
                >
                  {Icon !== null ? <Icon className="size-3.5" aria-hidden="true" /> : null}
                  {t(`chips.${category.id}`)}
                </button>
              </span>
            );
          })}

          <span
            className={cn(
              CHIP_CLASS,
              'ml-auto cursor-not-allowed text-neutral-400 dark:text-neutral-500',
            )}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('chips.filter')}
          </span>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2">
          {query.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">{t('idle')}</p>
          ) : search.isPending ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">{tCommon('loading')}</p>
          ) : search.isError ? (
            <p className="px-3 py-8 text-center text-sm text-red-600 dark:text-red-400">
              {t('loadFailed')}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-neutral-500">{t('empty')}</p>
          ) : (
            <>
              <p className="px-3 pt-1 pb-2 text-xs font-medium text-neutral-500">
                {t('results', { count: results.length })}
              </p>
              <ul className="space-y-0.5">
                {results.map((page) => (
                  <li key={page.id}>
                    <button
                      type="button"
                      onClick={() => openPage(page)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:hover:bg-neutral-800 dark:focus-visible:ring-neutral-600"
                    >
                      <span className="text-base" aria-hidden="true">
                        {page.icon ?? '📄'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {page.title || tCommon('untitled')}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">
                          {tHeader('editedAgo', { time: agoText(page.updatedAt) })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
