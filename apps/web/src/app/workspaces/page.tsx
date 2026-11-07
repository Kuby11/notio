'use client';

import { useBlockCreator } from '@/modules/editor';
import { usePages } from '@/modules/pages';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useWorkspaces } from '@/modules/workspaces';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Input } from '@/shared/ui/input';

export default function WorkspacesPage() {
  const t = useTranslations('workspace');
  const tOnboarding = useTranslations('onboarding');
  const workspaces = useWorkspaces();
  const router = useRouter();
  const [name, setName] = useState('');

  useWelcomePage(workspaces.list.data, router, tOnboarding);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{t('listTitle')}</h1>
      <form
        className="mt-6 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (name.trim()) {
            await workspaces.createWorkspace.mutateAsync(name.trim());
            setName('');
          }
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
        />
        <Button type="submit" disabled={workspaces.createWorkspace.isPending}>
          <Plus className="mr-1 h-4 w-4" />
          {t('create')}
        </Button>
      </form>

      <div className="mt-6 space-y-3">
        {workspaces.list.data?.map((w) => (
          <Card key={w.id}>
            <CardHeader>
              <CardTitle>
                <a href={`/workspaces/${w.id}`} className="hover:underline">
                  {w.name}
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-neutral-500">
              {w.currentUserRole
                ? t('role', { role: t(`roles.${w.currentUserRole}`) })
                : t('noAccess')}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

/**
 * Welcome onboarding for a brand-new user.
 *
 * workspace-service auto-creates the personal workspace on the first list
 * call: a freshly created (under a minute ago) single workspace means a new
 * user. For them the first page — a short welcome note — is created and the
 * user is navigated straight into the editor, so nobody lands on an empty
 * shell. The freshness check keeps this one-shot: existing users and
 * workspaces older than a minute are left alone.
 */
function useWelcomePage(
  workspaces: { id: string; createdAt: string }[] | undefined,
  router: ReturnType<typeof useRouter>,
  t: ReturnType<typeof useTranslations<'onboarding'>>,
) {
  const { createPage } = usePages('', null, 'tree', { enabled: false });
  const createBlock = useBlockCreator();
  const runningRef = useRef(false);

  useEffect(() => {
    if (runningRef.current || !workspaces || workspaces.length !== 1) {
      return;
    }

    const workspace = workspaces[0];

    if (workspace === undefined || Date.now() - Date.parse(workspace.createdAt) > 60_000) {
      return;
    }

    if (sessionStorage.getItem(`onboarded:${workspace.id}`)) {
      return;
    }

    runningRef.current = true;
    sessionStorage.setItem(`onboarded:${workspace.id}`, '1');

    void (async () => {
      try {
        const page = await createPage.mutateAsync({
          workspaceId: workspace.id,
          parentId: null,
          title: t('pageTitle'),
        });

        const blocks: {
          type: 'heading' | 'paragraph' | 'toDo';
          level?: 1 | 2;
          checked?: boolean;
          text: string;
        }[] = [
          { type: 'heading', level: 1, text: t('heading') },
          { type: 'paragraph', text: t('intro') },
          { type: 'paragraph', text: t('tipSlash') },
          { type: 'toDo', checked: false, text: t('todoSidebar') },
          { type: 'toDo', checked: false, text: t('todoDatabase') },
          { type: 'toDo', checked: false, text: t('todoSettings') },
        ];

        for (const block of blocks) {
          const content =
            block.type === 'heading'
              ? { type: 'heading' as const, level: block.level ?? 1, content: block.text }
              : block.type === 'toDo'
                ? { type: 'toDo' as const, checked: block.checked ?? false, content: block.text }
                : { type: 'paragraph' as const, content: block.text };

          await createBlock.mutateAsync({ pageId: page.id, content });
        }

        router.push(`/workspaces/${workspace.id}/${page.id}`);
      } catch {
        // Onboarding is best-effort: an empty workspace is still usable.
        sessionStorage.removeItem(`onboarded:${workspace.id}`);
        runningRef.current = false;
      }
    })();
    // createPage/createBlock are stable mutations; t follows the locale.
  }, [workspaces, router, createPage, createBlock, t]);
}
