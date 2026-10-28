'use client';

import { useTranslations } from 'next-intl';
import { useWorkspaces } from '@/modules/workspaces';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { Plus } from 'lucide-react';
import { useState } from 'react';

export default function WorkspacesPage() {
  const t = useTranslations('workspace');
  const workspaces = useWorkspaces();
  const [name, setName] = useState('');

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
