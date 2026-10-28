'use client';

import { Lock, Star } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { cn } from 'cn';
import { toast } from '@/shared/ui/toast';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/ui/breadcrumb';
import { formatDate } from '@/core/preferences/preferences';
import { usePreferences } from '@/core/preferences/preferences.store';
import { useSidebarStore } from '@/core/stores/sidebar.store';
import { usePages } from '../../hooks/use-pages';
import { normalizePageTitle } from '../../utils/page';
import { editedAgo } from '../../utils/time-ago';
import { PageActionsMenu } from '../private/page-actions-menu';

interface PageHeaderProps {
  workspaceId: string;
  pageId: string;
}

/**
 * Page header.
 *
 * The top bar is sticky above the scrollable document: on the left
 * breadcrumbs "parents → page" (workspace path is already visible in
 * the sidebar so not needed in breadcrumbs), on the right — "edited N ago", favorites
 * and the page menu. The large title stays in the document flow like in
 * Notion and is disabled together with content for locked pages.
 */
/**
 * Copy document content to clipboard.
 *
 * Text is taken from the rendered editor: top-level blocks
 * are separated by blank lines, innerText preserves line breaks
 * inside blocks (hard breaks). Returns the result; translations and toasts
 * are shown by the calling component.
 */
async function copyDocumentContent(): Promise<'copied' | 'failed'> {
  const doc = document.querySelector('.ProseMirror');

  if (!doc) {
    return 'failed';
  }

  const text = [...doc.children]
    .map((node) => (node instanceof HTMLElement ? node.innerText : (node.textContent ?? '')))
    .map((blockText) => blockText.trim())
    .join('\n\n');

  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

export function PageHeader({ workspaceId, pageId }: PageHeaderProps) {
  const t = useTranslations('pages.header');
  const sidebarCollapsed = useSidebarStore((state) => state.collapsed);
  const tMenu = useTranslations('pages.menu');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const preferences = usePreferences();
  const router = useRouter();
  const { breadcrumb, pageDetail, createPage, renamePage, toggleFavorite } = usePages(
    workspaceId,
    pageId,
    'breadcrumb',
  );
  const [tick, setTick] = useState(0);
  const [title, setTitle] = useState<string | null>(null);

  const chain = breadcrumb.data ?? [];
  // Get metadata from detail: it's polled more frequently and contains isLocked.
  const page = pageDetail.data ?? chain.at(-1) ?? null;
  const isLocked = page?.isLocked === true;

  // Tick every 30 seconds so "time ago" updates automatically.
  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 30_000);

    return () => clearInterval(interval);
  }, []);

  // Local title syncs on page change but not on every refetch —
  // otherwise cursor would jump while typing.
  useEffect(() => {
    setTitle(null);
  }, [pageId]);

  const displayedTitle = title ?? page?.title ?? '';
  // Time units translated here: utility returns structure.
  const ago = page ? editedAgo(page.updatedAt) : null;
  const agoText =
    ago === null
      ? ''
      : ago.unit === 'now'
        ? t('justNow')
        : ago.unit === 'minutes'
          ? t('minutesAgo', { count: ago.value })
          : ago.unit === 'hours'
            ? t('hoursAgo', { count: ago.value })
            : ago.unit === 'days'
              ? t('daysAgo', { count: ago.value })
              : formatDate(ago.value, preferences, locale);

  void tick;

  // Debounced title save: 800ms after last change.
  useEffect(() => {
    if (title === null || title === (page?.title ?? '')) {
      return;
    }

    const timer = setTimeout(() => {
      const next = normalizePageTitle(title, tCommon('untitled'));

      if (next !== page?.title) {
        renamePage.mutate({ id: pageId, workspaceId, title: next });
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [title, page?.title, pageId, workspaceId, renamePage, tCommon]);

  async function addChildPage(): Promise<void> {
    const created = await createPage.mutateAsync({
      workspaceId,
      parentId: pageId,
      title: '',
    });

    router.push(`/workspaces/${workspaceId}/${created.id}`);
  }

  return (
    <>
      {/* Panel is a direct child of scrollable main: sticky is bounded
          by parent, inside a column wrapper it wouldn't stick. Negative
          horizontal margins cancel px-6 on main — panel spans full width.
          Top padding on main is absent (see AppLayout), so the panel
          sticks to the very top when scrolling. While the sidebar is
          collapsed the panel also swallows the gutter the shell keeps for
          the floating reopen button, so the border still reaches the edge. */}
      <div
        className={cn(
          'sticky top-0 z-30 border-b bg-background transition-[margin,padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          sidebarCollapsed ? '-ml-12 -mr-6 pr-6 pl-12' : '-mx-6 px-6',
        )}
      >
        <div className="mx-auto flex h-10 w-full max-w-52rem items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <Breadcrumb>
              <BreadcrumbList>
                {chain.map((item, index) => {
                  const isLast = index === chain.length - 1;

                  // Separator is a sibling of BreadcrumbItem, not a child: li
                  // inside li breaks hydration (React nested li error).
                  return (
                    <Fragment key={item.id}>
                      <BreadcrumbItem>
                        {isLast ? (
                          <BreadcrumbPage>
                            <span aria-hidden="true">{item.icon ?? '📄'}</span>
                            <span className="ml-1">{item.title || tCommon('untitled')}</span>
                          </BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink href={`/workspaces/${workspaceId}/${item.id}`}>
                            <span aria-hidden="true">{item.icon ?? '📄'}</span>
                            <span className="ml-1">{item.title || tCommon('untitled')}</span>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {!isLast ? <BreadcrumbSeparator /> : null}
                    </Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {page ? (
              <span className="text-muted-foreground flex items-center gap-1 text-xs whitespace-nowrap">
                {isLocked ? (
                  <span title={t('locked')}>
                    <Lock className="size-3.5" aria-hidden="true" />
                  </span>
                ) : null}
                {agoText && t('editedAgo', { time: agoText })}
              </span>
            ) : null}
            <button
              type="button"
              aria-label={page?.isFavorite ? tMenu('favoriteRemove') : tMenu('favoriteAdd')}
              title={page?.isFavorite ? tMenu('favoriteRemove') : tMenu('favoriteAdd')}
              onClick={() =>
                page &&
                toggleFavorite.mutate({
                  id: page.id,
                  workspaceId,
                  isFavorite: !page.isFavorite,
                })
              }
              className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            >
              {page?.isFavorite ? (
                <Star className="h-4 w-4 fill-current" aria-hidden="true" />
              ) : (
                <Star className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            {page ? (
              <PageActionsMenu
                page={page}
                workspaceId={workspaceId}
                align="end"
                onCopyContent={async () => {
                  const result = await copyDocumentContent();

                  if (result === 'copied') {
                    toast(tMenu('copySuccess'), 'success');
                  } else {
                    toast(tMenu('copyFailed'));
                  }
                }}
                onCreateChildPage={() => {
                  void addChildPage();
                }}
                showLock
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-52rem">
        <input
          value={displayedTitle}
          placeholder={tCommon('untitled')}
          aria-label={t('titleLabel')}
          disabled={isLocked}
          title={isLocked ? t('locked') : undefined}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              // Remove focus from document: title will be saved by debounce.
              (event.target as HTMLInputElement).blur();
            }
          }}
          className="mt-4 mb-2 w-full bg-transparent text-center text-4xl font-bold outline-none placeholder:text-neutral-300 disabled:cursor-default disabled:opacity-60 dark:placeholder:text-neutral-700"
        />
      </div>
    </>
  );
}
