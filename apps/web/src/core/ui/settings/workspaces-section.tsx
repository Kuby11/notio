'use client';

import type { WorkspaceListItem } from '@notio/contracts';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { useWorkspaces } from '@/modules/workspaces';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { toast } from '@/shared/ui/toast';
import { ConfirmPhraseDialog } from './confirm-phrase-dialog';
import { SettingsGroup } from './settings-layout';

function WorkspaceRow({
  workspace,
  onDelete,
}: {
  workspace: WorkspaceListItem;
  onDelete: (workspace: WorkspaceListItem) => void;
}) {
  const t = useTranslations('settings.workspaces');
  const { renameWorkspace } = useWorkspaces();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(workspace.name);

  async function submitRename(): Promise<void> {
    setEditing(false);

    const next = name.trim();

    if (next.length === 0 || next === workspace.name) {
      setName(workspace.name);
      return;
    }

    try {
      await renameWorkspace.mutateAsync({ id: workspace.id, name: next });
    } catch {
      // The service enforces the owner-only rule; show a readable failure.
      setName(workspace.name);
      toast(t('renameFailed'));
    }
  }

  return (
    <li className="flex min-h-11 items-center gap-2 border-b border-border/70 py-2.5 last:border-b-0">
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRename();
          }}
        >
          <Input
            autoFocus
            value={name}
            aria-label={t('nameLabel')}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              void submitRename();
            }}
            onKeyDown={(event) => {
              event.stopPropagation();

              if (event.key === 'Enter') {
                event.preventDefault();
                void submitRename();
              }

              if (event.key === 'Escape') {
                setName(workspace.name);
                setEditing(false);
              }
            }}
            className="h-8 max-w-sm"
          />
          <Button type="submit" variant="ghost" size="icon-sm" aria-label={t('saveName')}>
            <Check className="size-4" aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <>
          <a
            href={`/workspaces/${workspace.id}`}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
          >
            {workspace.name}
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('rename', { name: workspace.name })}
            onClick={() => setEditing(true)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          {workspace.currentUserRole === 'owner' && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={t('delete', { name: workspace.name })}
              onClick={() => onDelete(workspace)}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          )}
        </>
      )}
    </li>
  );
}

export function WorkspacesSection() {
  const t = useTranslations('settings.workspaces');
  const { list, createWorkspace, archiveWorkspace } = useWorkspaces();
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState<WorkspaceListItem | null>(null);

  async function submitCreate(event: FormEvent): Promise<void> {
    event.preventDefault();

    const next = name.trim();

    if (next.length === 0) {
      return;
    }

    try {
      await createWorkspace.mutateAsync(next);
      setName('');
    } catch {
      toast(t('createFailed'));
    }
  }

  async function confirmDelete(): Promise<void> {
    if (pendingDelete === null) {
      return;
    }

    try {
      await archiveWorkspace.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      toast(t('deleteFailed'));
    }
  }

  const workspaces = list.data ?? [];
  const showList = !list.isPending && !list.isError && workspaces.length > 0;

  return (
    <div className="flex flex-col gap-10">
      <SettingsGroup title={t('title')} hint={t('hint')}>
        <form
          className="flex gap-2 border-b border-border/70 py-4"
          onSubmit={(event) => void submitCreate(event)}
        >
          <Input
            value={name}
            aria-label={t('nameLabel')}
            placeholder={t('nameLabel')}
            onChange={(event) => setName(event.target.value)}
            className="max-w-sm"
          />
          <Button type="submit" disabled={createWorkspace.isPending || name.trim().length === 0}>
            <Plus data-icon="inline-start" aria-hidden="true" />
            {t('create')}
          </Button>
        </form>

        {list.isPending && <p className="text-muted-foreground py-4 text-sm">{t('loading')}</p>}

        {list.isError && <p className="text-muted-foreground py-4 text-sm">{t('loadFailed')}</p>}

        {!list.isPending && !list.isError && workspaces.length === 0 && (
          <p className="text-muted-foreground py-4 text-sm">{t('empty')}</p>
        )}

        {showList && (
          <ul className="flex flex-col">
            {workspaces.map((workspace) => (
              <WorkspaceRow key={workspace.id} workspace={workspace} onDelete={setPendingDelete} />
            ))}
          </ul>
        )}
      </SettingsGroup>

      <ConfirmPhraseDialog
        open={pendingDelete !== null}
        title={t('deleteTitle', { name: pendingDelete?.name ?? '' })}
        description={t('deleteBody')}
        phrase={pendingDelete?.name ?? ''}
        confirmLabel={t('deleteConfirm')}
        countdownLabel={(seconds) => t('deleteWait', { seconds })}
        busy={archiveWorkspace.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
          }
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
