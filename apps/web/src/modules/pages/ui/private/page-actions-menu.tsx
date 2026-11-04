'use client';

import {
  ClipboardCopy,
  Copy,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  StarOff,
  Trash,
} from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { usePages } from '../../hooks/use-pages';
import { normalizePageTitle } from '../../utils/page';
import type { Page } from '@notio/contracts';

interface PageActionsMenuProps {
  page: Page;
  workspaceId: string;
  /** Side the content appears on. */
  align?: 'start' | 'end';
  /** Notifies owner when menu opens/closes (anchor must not hide). */
  onOpenChange?: (open: boolean) => void;
  /** Show "Copy content" (only in editor header). */
  onCopyContent?: () => void;
  /** Show page lock option (only in editor header). */
  showLock?: boolean;
  /** Show "New child page"; only owner can create. */
  onCreateChildPage?: () => void;
}

/**
 * Page "three dots" menu: favorites, duplicate, rename
 * (via dialog), trash. Used in both the sidebar tree and the editor
 * header; the header additionally includes copying content
 * and locking the page.
 */
export function PageActionsMenu({
  page,
  workspaceId,
  align = 'start',
  onOpenChange,
  onCopyContent,
  showLock = false,
  onCreateChildPage,
}: PageActionsMenuProps) {
  const t = useTranslations('pages.menu');
  const tRename = useTranslations('pages.rename');
  const tSidebar = useTranslations('sidebar');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const { duplicatePage, renamePage, trashPage, toggleFavorite, updatePage } = usePages(
    workspaceId,
    page.id,
    'tree',
    { enabled: false },
  );
  const [, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(page.title);

  function submitRename(): void {
    const next = normalizePageTitle(renameValue, tCommon('untitled'));

    if (next !== page.title) {
      renamePage.mutate({ id: page.id, workspaceId, title: next });
    }

    setRenameOpen(false);
  }

  /** Trashing the open page must leave it immediately: the route is read-only in trash. */
  async function moveToTrash(): Promise<void> {
    try {
      await trashPage.mutateAsync({ id: page.id, workspaceId });

      if (pathname === `/workspaces/${workspaceId}/${page.id}`) {
        router.push(`/workspaces/${workspaceId}`);
      }
    } catch {
      // The page stays open and editable when the move fails.
    }
  }

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          setMenuOpen(open);
          onOpenChange?.(open);
        }}
      >
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={tSidebar('pageMenu')}
              className="rounded p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          }
        />
        <DropdownMenuContent align={align} className="w-56!">
          {onCreateChildPage ? (
            <DropdownMenuItem className="text-xs" onClick={onCreateChildPage}>
              <Plus aria-hidden="true" />
              {tSidebar('newChildPage')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="text-xs"
            onClick={() =>
              toggleFavorite.mutate({ id: page.id, workspaceId, isFavorite: !page.isFavorite })
            }
          >
            {page.isFavorite ? <StarOff aria-hidden="true" /> : <Star aria-hidden="true" />}
            {page.isFavorite ? t('favoriteRemove') : t('favoriteAdd')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs"
            onClick={() => duplicatePage.mutate({ id: page.id, workspaceId })}
            disabled={duplicatePage.isPending}
          >
            <Copy aria-hidden="true" />
            {t('duplicate')}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs"
            onClick={() => {
              setRenameValue(page.title);
              setRenameOpen(true);
            }}
          >
            <Pencil aria-hidden="true" />
            {t('rename')}
          </DropdownMenuItem>
          {onCopyContent ? (
            <DropdownMenuItem className="text-xs" onClick={onCopyContent}>
              <ClipboardCopy aria-hidden="true" />
              {t('copyContent')}
            </DropdownMenuItem>
          ) : null}
          {showLock ? (
            <DropdownMenuItem
              className="text-xs"
              onClick={() =>
                updatePage.mutate({
                  id: page.id,
                  workspaceId,
                  patch: { isLocked: !page.isLocked },
                })
              }
              disabled={updatePage.isPending}
            >
              {page.isLocked ? <LockOpen aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {page.isLocked ? t('unlock') : t('lock')}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs"
            variant="destructive"
            disabled={trashPage.isPending}
            onClick={() => {
              void moveToTrash();
            }}
          >
            <Trash aria-hidden="true" />
            {t('trash')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tRename('title')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                submitRename();
              }
            }}
            aria-label={tRename('inputLabel')}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button onClick={submitRename}>{tRename('submit')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
