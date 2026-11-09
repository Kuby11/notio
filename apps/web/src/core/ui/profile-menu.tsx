'use client';

import { Check, ChevronsUpDown, Library, LogOut, Plus, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/modules/auth';
import { useWorkspaces } from '@/modules/workspaces';
import { Button } from '@/shared/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { toast } from '@/shared/ui/toast';
import { Avatar } from './avatar';
import { useSettingsStore } from '../stores/settings.store';

interface ProfileMenuProps {
  /** The active workspace — marked with a check in the list. */
  workspaceId: string;
}

/**
 * Profile button at the top of the sidebar and its popover.
 *
 * Inside is a user card (initials, name, email), the workspace list with a
 * new-workspace action, plus "Library", "Settings" and "Sign out". Data comes from the
 * useAuth and useWorkspaces facade hooks: the component keeps only UI state
 * (creation form, open popover/dialog).
 */
export function ProfileMenu({ workspaceId }: ProfileMenuProps) {
  const t = useTranslations('sidebar.profile');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const openSettings = useSettingsStore((state) => state.openSettings);
  const { session, signOut } = useAuth();
  const { list, createWorkspace } = useWorkspaces();
  const [menuOpen, setMenuOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const user = session.data?.user ?? null;
  const displayName = user?.name.trim() || user?.email || t('profile');

  async function submitNewWorkspace(): Promise<void> {
    const name = newName.trim();

    if (!name) {
      return;
    }

    const created = await createWorkspace.mutateAsync(name);

    setNewName('');
    setCreating(false);
    router.push(`/workspaces/${created.id}`);
  }

  async function handleSignOut(): Promise<void> {
    // A network error is not treated as sign-out: the cookie is still there, the session lives.
    try {
      await signOut.mutateAsync();
      setMenuOpen(false);
      router.replace('/login');
      // Server components may still hold the signed-in shell: refresh re-runs
      // the proxy so no page is served from the old session.
      router.refresh();
    } catch {
      toast(t('signOutFailed'));
    }
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger
          render={
            <Button variant="ghost" className="w-full justify-between gap-2 px-2">
              <span className="flex min-w-0 items-center gap-2">
                <Avatar name={user?.name ?? ''} src={user?.image} size="sm" />
                <span className="truncate text-sm font-medium">{displayName}</span>
              </span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-64! gap-0 p-1">
          <div className="flex items-center gap-2 px-2 py-2">
            <Avatar name={user?.name ?? ''} src={user?.image} size="lg" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {user?.name || tCommon('untitled')}
              </div>
              <div className="text-muted-foreground truncate text-xs">{user?.email ?? '…'}</div>
            </div>
          </div>

          <div className="-mx-1 my-1 border-t" role="presentation" />

          <div className="text-muted-foreground px-2 py-1 text-xs">{t('workspaces')}</div>
          <div className="max-h-44 overflow-y-auto">
            {list.data?.map((workspace) => (
              <a
                key={workspace.id}
                href={`/workspaces/${workspace.id}`}
                className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="truncate">{workspace.name}</span>
                {workspace.id === workspaceId ? (
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : null}
              </a>
            ))}
          </div>

          {creating ? (
            <form
              className="flex items-center gap-1 px-2 py-1"
              onSubmit={(event) => {
                event.preventDefault();
                void submitNewWorkspace();
              }}
            >
              <input
                autoFocus
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder={t('workspaceName')}
                aria-label={t('workspaceName')}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="submit"
                aria-label={t('createWorkspace')}
                disabled={createWorkspace.isPending}
                className="rounded p-1 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('createWorkspace')}
            </button>
          )}

          <div className="-mx-1 my-1 border-t" role="presentation" />

          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push(`/workspaces/${workspaceId}`);
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Library className="h-4 w-4" aria-hidden="true" />
            {t('library')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              openSettings();
            }}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            {t('settings')}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            disabled={signOut.isPending}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-red-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-red-400 dark:hover:bg-neutral-800"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {signOut.isPending ? t('signingOut') : t('signOut')}
          </button>
        </PopoverContent>
      </Popover>
    </>
  );
}
