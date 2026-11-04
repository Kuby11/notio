'use client';

import { PanelLeftClose, Search, Star, Trash2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, type FormEvent } from 'react';
import { cn } from 'cn';
import { DatabasesTree, useWorkspaceDatabases } from '@/modules/databases';
import { FavoritesList, PageTree, SearchDialog, TrashList, usePages } from '@/modules/pages';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
import { useKeybinding, useModKeyLabel } from '@/shared/hooks/use-keybinding';
import { Button } from '@/shared/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip';
import { SIDEBAR_ID, useSidebarStore } from '../stores/sidebar.store';
import { ProfileMenu } from './profile-menu';

interface AppSidebarProps {
  workspaceId: string;
}

type SidebarPanel = 'favorites' | 'trash';

/** Shared look of the plain icon rows (Favorites, Trash): a Notion pill. */
const ROW_CLASS =
  'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-neutral-600 transition-colors hover:bg-neutral-100/80 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-neutral-100';

/** Shortcut hint chip inside tooltips (TooltipContent styles the slot). */
const TOOLTIP_KBD_CLASS = 'rounded-sm bg-background/15 px-1.5 py-0.5 font-mono text-[10px]';

/**
 * Side panel: the profile button with its popover (profile, workspace list,
 * creation, library, settings, sign out), the search input, the icon rows and
 * the "Private" section with the page tree, favorites and trash.
 *
 * Collapse lives here rather than in `AppLayout`: the layout remounts on
 * every navigation, while the sidebar store keeps the state. The toggle sits
 * on its own row at the top right edge of the panel; when collapsed the panel
 * shrinks to zero width and the reopen control appears in the shell
 * (`SidebarOpenButton` in `AppLayout`), so every page has it. The markup stays
 * mounted while collapsed (clipped, `inert` and `aria-hidden`) so the tree
 * keeps its expansion state and the Ctrl+K search keeps working with the panel
 * closed.
 *
 * The component lives in `core` because it assembles several modules.
 * It must not live in `shared/ui`: shared may not import modules.
 * All data access goes through the modules' facade hooks; the component keeps
 * only UI state (which panel is open).
 */
export function AppSidebar({ workspaceId }: AppSidebarProps) {
  const t = useTranslations('sidebar');
  const tPages = useTranslations('pages');
  const pathname = usePathname();
  const modKey = useModKeyLabel();
  const collapsed = useSidebarStore((state) => state.collapsed);
  const toggleSidebar = useSidebarStore((state) => state.toggle);
  const closeSidebar = useSidebarStore((state) => state.close);
  const [panel, setPanel] = useState<SidebarPanel | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const workspaceDatabases = useWorkspaceDatabases(workspaceId);
  const { setExpanded } = usePages(workspaceId, null, 'tree', { enabled: false });

  // Opening a page or a database should reveal its database rows without an
  // extra click. The effect runs only when the route or the branch data changes,
  // so a manual collapse stays collapsed afterwards.
  useEffect(() => {
    const pagePrefix = `/workspaces/${workspaceId}/`;
    const activeDatabase = workspaceDatabases.items.find(
      (database) => pathname === `/workspaces/${workspaceId}/databases/${database.id}`,
    );
    const activePageId = pathname.startsWith(pagePrefix)
      ? pathname.slice(pagePrefix.length).split('/')[0]
      : null;
    const branchId =
      activeDatabase?.parentId ??
      (activePageId && !activePageId.startsWith('databases') ? activePageId : null);

    if (branchId && workspaceDatabases.items.some((database) => database.parentId === branchId)) {
      setExpanded(branchId, true);
    }
  }, [pathname, workspaceDatabases.items, setExpanded, workspaceId]);

  useKeybinding('mod+/', toggleSidebar);
  useKeybinding('mod+k', () => setSearchOpen(true));

  // The search modal opens on submit: the submitted text seeds its query.
  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSearchOpen(true);
  }

  const searchDialog = (
    <SearchDialog
      workspaceId={workspaceId}
      open={searchOpen}
      initialQuery={searchQuery}
      onOpenChange={setSearchOpen}
    />
  );

  // The panel disappears completely: the width animates to zero and the content
  // fades out, so no rail is left behind. Reopening is the topbar button's job.
  return (
    <>
      <aside
        id={SIDEBAR_ID}
        data-collapsed={collapsed || undefined}
        aria-hidden={collapsed || undefined}
        // Hidden content must not be reachable with Tab while the panel is closed.
        inert={collapsed || undefined}
        className={cn(
          'h-screen shrink-0 overflow-hidden bg-neutral-50 transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-neutral-950',
          collapsed ? 'w-0' : 'w-64',
        )}
      >
        {/* Fixed width keeps the content from reflowing while the panel is
            clipped: the inner column simply slides out of view. */}
        <div
          className={cn(
            'flex h-full w-64 flex-col border-r border-neutral-200 transition-opacity duration-200 dark:border-neutral-800',
            collapsed ? 'opacity-0' : 'opacity-100',
          )}
        >
          {/* Collapse toggle on its own row, right-aligned to the panel edge:
              the workspace switcher keeps the full width below it. */}
          <div className="flex justify-end px-2 pt-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(event) => {
                      // Drop focus before the panel becomes inert: an
                      // aria-hidden ancestor may not keep the focused element.
                      event.currentTarget.blur();
                      closeSidebar();
                    }}
                    aria-controls={SIDEBAR_ID}
                    aria-expanded={!collapsed}
                    aria-label={t('closeSidebar')}
                    className="text-neutral-500 dark:text-neutral-400"
                  />
                }
              >
                <PanelLeftClose aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end">
                {t('closeSidebar')}
                <kbd data-slot="kbd" className={TOOLTIP_KBD_CLASS}>
                  {modKey} + /
                </kbd>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Search sits under the header row; the kbd chip hints Ctrl+K. */}
          <form className="px-2 pb-2" onSubmit={submitSearch} role="search">
            <div className="flex h-8 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-100/60 px-2 focus-within:border-neutral-300 focus-within:bg-white dark:border-neutral-800 dark:bg-neutral-900/60 dark:focus-within:border-neutral-700 dark:focus-within:bg-neutral-900">
              <Search className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-neutral-400"
              />
              <kbd className="pointer-events-none shrink-0 rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-400 dark:border-neutral-700 dark:bg-neutral-800">
                {modKey} K
              </kbd>
            </div>
          </form>

          <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label={t('pages')}>
            <button
              type="button"
              onClick={() => setPanel('favorites')}
              aria-haspopup="dialog"
              className={ROW_CLASS}
            >
              <Star className="size-4 shrink-0" aria-hidden="true" />
              {t('favorites')}
            </button>
            <button
              type="button"
              onClick={() => setPanel('trash')}
              aria-haspopup="dialog"
              className={ROW_CLASS}
            >
              <Trash2 className="size-4 shrink-0" aria-hidden="true" />
              {t('trash')}
            </button>

            <p className="text-neutral-400 px-2 pt-4 pb-1 text-xs font-medium dark:text-neutral-500">
              {t('private')}
            </p>

            <PageTree
              workspaceId={workspaceId}
              extras={(parentId, depth) => (
                <DatabasesTree workspaceId={workspaceId} parentId={parentId} depth={depth} />
              )}
              hasExtras={(parentId) =>
                workspaceDatabases.items.some(
                  (database) => (database.parentId ?? null) === parentId,
                )
              }
            />
          </nav>

          {/* Profile stays at the bottom edge, as in Notion, instead of
              competing with the workspace tree at the top of the panel. */}
          <div className="border-neutral-200 p-2 dark:border-neutral-800">
            <ProfileMenu workspaceId={workspaceId} />
          </div>

          {/* Panels open as a dialog over the page: the tree stays
              in place while the content can be scrolled inside the window. */}
          <Dialog
            open={panel !== null}
            onOpenChange={(open) => {
              if (!open) {
                setPanel(null);
              }
            }}
          >
            {panel !== null ? (
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{panel === 'trash' ? t('trash') : t('favorites')}</DialogTitle>
                  <DialogDescription>
                    {panel === 'trash' ? tPages('trash.hint') : tPages('trash.favoritesHint')}
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                  {panel === 'favorites' ? (
                    <FavoritesList workspaceId={workspaceId} />
                  ) : (
                    <TrashList workspaceId={workspaceId} />
                  )}
                </div>
              </DialogContent>
            ) : null}
          </Dialog>
        </div>
      </aside>

      {searchDialog}
    </>
  );
}
