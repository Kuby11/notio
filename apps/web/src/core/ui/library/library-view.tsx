'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  ListFilter,
  Lock,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Users,
} from 'lucide-react';
import { cn } from 'cn';
import type { Page } from '@notio/contracts';
import { useAuth } from '@/modules/auth';
import { shortAgo, usePages } from '@/modules/pages';
import { useWorkspaces } from '@/modules/workspaces';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { readPageVisits } from '../../preferences/last-page';
import { COLUMN_ICONS, LIBRARY_COLUMNS, LibraryRow, type LibraryColumn } from './library-row';

interface LibraryViewProps {
  workspaceId: string;
}

/** Which pages the table shows. Every tab maps to real page data. */
type LibraryTab = 'recent' | 'favorites' | 'shared' | 'private';

/** Where a page sits: at the workspace root or inside another page. */
type SourceFilter = 'all' | 'root' | 'nested';

interface Row {
  page: Page;
  depth: number;
}

const TABS: readonly { id: LibraryTab; icon: typeof Clock }[] = [
  { id: 'recent', icon: Clock },
  { id: 'favorites', icon: Star },
  { id: 'shared', icon: Users },
  { id: 'private', icon: Lock },
];

const SOURCES: readonly SourceFilter[] = ['all', 'root', 'nested'];

const TAB_CLASS =
  'flex h-7 items-center gap-1.5 rounded-md px-2 text-sm transition-colors whitespace-nowrap';
const TOOL_BUTTON_CLASS =
  'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

/**
 * Library: the workspace home as a sortable table of every page.
 *
 * The table is flat data nested on the client: `usePages` with scope `all`
 * returns every page of the workspace with its `parentId`, so a tab, a search
 * or a source filter applies to the whole workspace rather than to the branch
 * that happens to be loaded. Filtering switches the table to a flat list
 * sorted by edit time; the "Recent" tab without filters keeps the tree order
 * and the expand chevrons.
 *
 * The component lives in `core` because it assembles the pages module (rows),
 * the workspaces module (creator names) and the auth session (who "mine" is).
 */
export function LibraryView({ workspaceId }: LibraryViewProps) {
  const t = useTranslations('library');
  const locale = useLocale();
  const router = useRouter();
  const { allPages, createPage } = usePages(workspaceId, null, 'all');
  const { members } = useWorkspaces(workspaceId);
  const { session } = useAuth();

  const [tab, setTab] = useState<LibraryTab>('recent');
  const [source, setSource] = useState<SourceFilter>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [hiddenColumns, setHiddenColumns] = useState<ReadonlySet<LibraryColumn>>(new Set());
  // Collapsed parents by id: the tree is expanded by default, so a missing
  // entry means "children are visible".
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // Visit times live in localStorage: read after mount, otherwise the server
  // and the client would render different cells.
  const [visits, setVisits] = useState<Record<string, string>>({});
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVisits(readPageVisits(workspaceId));
  }, [workspaceId]);

  // The field is always mounted at zero width: focus it as soon as it opens,
  // otherwise the user would have to click a second time.
  useEffect(() => {
    if (searchOpen) {
      searchRef.current?.focus();
    }
  }, [searchOpen]);

  const NameIcon = COLUMN_ICONS.name;
  const CreatorIcon = COLUMN_ICONS.createdBy;
  const SourceIcon = COLUMN_ICONS.source;
  const EditedIcon = COLUMN_ICONS.lastEdited;
  const VisitedIcon = COLUMN_ICONS.lastVisited;

  const me = session.data?.user.id ?? null;
  const pages = useMemo(() => allPages.data ?? [], [allPages.data]);

  const byId = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);

  /** Children by parent id; a page whose parent is gone is shown as a root. */
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, Page[]>();

    for (const page of pages) {
      const parentId = page.parentId !== null && byId.has(page.parentId) ? page.parentId : null;
      const siblings = map.get(parentId);

      if (siblings === undefined) {
        map.set(parentId, [page]);
      } else {
        siblings.push(page);
      }
    }

    return map;
  }, [pages, byId]);

  const creators = useMemo(() => {
    const map = new Map<string, string>();

    for (const member of members.data ?? []) {
      map.set(member.userId, member.user.name.trim() || member.user.email);
    }

    return map;
  }, [members.data]);

  /** Fallback for the current user: their own pages keep a name even if the member list fails. */
  const myName = session.data?.user.name.trim() || session.data?.user.email || null;

  const needle = query.trim().toLowerCase();
  const filtered = tab !== 'recent' || source !== 'all' || needle.length > 0;

  const visiblePages = useMemo(
    () =>
      pages.filter((page) => {
        if (tab === 'favorites' && !page.isFavorite) {
          return false;
        }

        if (tab === 'shared' && (me === null || page.createdBy === me)) {
          return false;
        }

        if (tab === 'private' && (me === null || page.createdBy !== me)) {
          return false;
        }

        if (source === 'root' && page.parentId !== null) {
          return false;
        }

        if (source === 'nested' && page.parentId === null) {
          return false;
        }

        return needle.length === 0 || page.title.toLowerCase().includes(needle);
      }),
    [pages, tab, source, me, needle],
  );

  const rows = useMemo<Row[]>(() => {
    // A filter flattens the table: matching pages are not necessarily related,
    // and indenting them by a hidden parent would read as a random offset.
    if (filtered) {
      return visiblePages
        .toSorted((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map((page) => ({ page, depth: 0 }));
    }

    const result: Row[] = [];

    const walk = (parentId: string | null, depth: number): void => {
      for (const page of childrenOf.get(parentId) ?? []) {
        result.push({ page, depth });

        if (!collapsed.has(page.id)) {
          walk(page.id, depth + 1);
        }
      }
    };

    walk(null, 0);

    return result;
  }, [filtered, visiblePages, childrenOf, collapsed]);

  const visibleColumns = useMemo(() => {
    const set = new Set<LibraryColumn>(LIBRARY_COLUMNS);

    for (const column of hiddenColumns) {
      set.delete(column);
    }

    return set;
  }, [hiddenColumns]);

  const formatTime = useMemo(() => {
    // `short` rather than `narrow`: the narrow Russian form drops the "ago"
    // word and renders as "-3d", which reads like a duration, not a point in time.
    const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });

    return (iso: string): string => {
      const ago = shortAgo(iso);

      return ago === null ? '—' : formatter.format(ago.value, ago.unit);
    };
  }, [locale]);

  function toggleCollapsed(pageId: string): void {
    setCollapsed((current) => {
      const next = new Set(current);

      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }

      return next;
    });
  }

  function toggleColumn(column: LibraryColumn): void {
    setHiddenColumns((current) => {
      const next = new Set(current);

      if (next.has(column)) {
        next.delete(column);
      } else {
        next.add(column);
      }

      return next;
    });
  }

  async function addPage(): Promise<void> {
    const created = await createPage.mutateAsync({ workspaceId, parentId: null, title: '' });

    router.push(`/workspaces/${workspaceId}/${created.id}`);
  }

  const loading = allPages.isPending;
  const failed = allPages.isError;

  return (
    <div className="pt-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button
          onClick={() => {
            void addPage();
          }}
          disabled={createPage.isPending}
          className="h-7 rounded-md bg-blue-600 px-2.5 text-[13px] text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          {t('newPage')}
        </Button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                TAB_CLASS,
                tab === id
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              {t(`tabs.${id}`)}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t('filter')}
                  title={t('filter')}
                  className={cn(TOOL_BUTTON_CLASS, source !== 'all' && 'bg-muted text-foreground')}
                />
              }
            >
              <ListFilter className="size-4" aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-48">
              <p className="px-1 text-xs font-medium text-muted-foreground">{t('filter')}</p>
              {SOURCES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setSource(option)}
                  className="flex items-center justify-between rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
                >
                  {t(`filters.${option}`)}
                  {source === option ? <Check className="size-3.5" aria-hidden="true" /> : null}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Search grows out of its own icon: the field stays mounted with a
              zero width, so the toolbar never reflows and no separate row is
              needed. */}
          <div
            className={cn(
              'flex h-7 items-center overflow-hidden rounded-md border transition-[width,background-color,border-color] duration-200 ease-out',
              searchOpen ? 'w-56 border-border bg-muted/40' : 'w-7 border-transparent',
            )}
          >
            <button
              type="button"
              onClick={() => {
                if (searchOpen) {
                  setQuery('');
                }

                setSearchOpen(!searchOpen);
              }}
              aria-label={t('search')}
              aria-expanded={searchOpen}
              title={t('search')}
              className={cn(TOOL_BUTTON_CLASS, 'shrink-0', searchOpen && 'text-foreground')}
            >
              <Search className="size-4" aria-hidden="true" />
            </button>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setQuery('');
                  setSearchOpen(false);
                }
              }}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              aria-hidden={!searchOpen}
              tabIndex={searchOpen ? 0 : -1}
              className={cn(
                'h-7 min-w-0 flex-1 bg-transparent pr-2 text-sm outline-none transition-opacity duration-200 placeholder:text-muted-foreground',
                searchOpen ? 'opacity-100' : 'opacity-0',
              )}
            />
          </div>

          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label={t('display')}
                  title={t('display')}
                  className={TOOL_BUTTON_CLASS}
                />
              }
            >
              <SlidersHorizontal className="size-4" aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-52">
              <p className="px-1 text-xs font-medium text-muted-foreground">{t('columnsTitle')}</p>
              {LIBRARY_COLUMNS.map((column) => {
                const Icon = COLUMN_ICONS[column];

                return (
                  <button
                    key={column}
                    type="button"
                    onClick={() => toggleColumn(column)}
                    aria-pressed={!hiddenColumns.has(column)}
                    className="flex items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {t(`columns.${column}`)}
                    </span>
                    {hiddenColumns.has(column) ? null : (
                      <Check className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border/70">
        <table className="w-full table-fixed border-collapse" aria-label={t('tableLabel')}>
          <thead className="bg-muted/40">
            <tr className="text-xs text-muted-foreground">
              <th scope="col" className="w-[38%] py-2 pr-2 pl-2 text-left font-medium">
                <span className="flex items-center gap-1.5">
                  <NameIcon className="size-3.5" aria-hidden="true" />
                  {t('columns.name')}
                </span>
              </th>
              {visibleColumns.has('createdBy') ? (
                <th scope="col" className="w-[16%] py-2 pr-2 text-left font-medium">
                  <span className="flex items-center gap-1.5">
                    <CreatorIcon className="size-3.5" aria-hidden="true" />
                    {t('columns.createdBy')}
                  </span>
                </th>
              ) : null}
              {visibleColumns.has('source') ? (
                <th scope="col" className="w-[20%] py-2 pr-2 text-left font-medium">
                  <span className="flex items-center gap-1.5">
                    <SourceIcon className="size-3.5" aria-hidden="true" />
                    {t('columns.source')}
                  </span>
                </th>
              ) : null}
              {visibleColumns.has('lastEdited') ? (
                <th scope="col" className="w-[13%] py-2 pr-2 text-left font-medium">
                  <span className="flex items-center gap-1.5">
                    <EditedIcon className="size-3.5" aria-hidden="true" />
                    {t('columns.lastEdited')}
                  </span>
                </th>
              ) : null}
              {visibleColumns.has('lastVisited') ? (
                <th scope="col" className="w-[13%] py-2 pr-2 text-left font-medium">
                  <span className="flex items-center gap-1.5">
                    <VisitedIcon className="size-3.5" aria-hidden="true" />
                    {t('columns.lastVisited')}
                  </span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {t('loading')}
                </td>
              </tr>
            ) : null}

            {failed ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-sm text-red-600">
                  {t('loadFailed')}
                </td>
              </tr>
            ) : null}

            {!loading && !failed && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-sm text-muted-foreground">
                  {filtered ? t('emptyFiltered') : t('empty')}
                </td>
              </tr>
            ) : null}

            {rows.map(({ page, depth }) => (
              <LibraryRow
                key={page.id}
                workspaceId={workspaceId}
                page={page}
                depth={depth}
                parent={page.parentId !== null ? byId.get(page.parentId) : undefined}
                creatorName={
                  creators.get(page.createdBy) ??
                  (me !== null && page.createdBy === me ? myName : null)
                }
                visitedAt={visits[page.id] ?? null}
                visible={visibleColumns}
                expandable={(childrenOf.get(page.id)?.length ?? 0) > 0}
                expanded={!collapsed.has(page.id)}
                onToggle={() => toggleCollapsed(page.id)}
                formatTime={formatTime}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
