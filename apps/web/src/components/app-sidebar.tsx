'use client';

import { useWorkspaces, useCreateWorkspace } from '@/features/workspaces/ui/use-workspaces';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Plus, Trash2, Star } from 'lucide-react';
import { useState } from 'react';
import { PageTree } from '@/features/pages/ui/page-tree';

interface AppSidebarProps {
  workspaceId: string;
}

/**
 * Боковая панель: переключатель workspace, дерево страниц, избранное и корзина.
 *
 * Sidebar — это UI-состояние (какой workspace выбран, какие узлы развёрнуты),
 * поэтому он живёт в компоненте и в Zustand, а не в серверном состоянии.
 */
export function AppSidebar({ workspaceId }: AppSidebarProps) {
  const workspaces = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const [newName, setNewName] = useState('');

  const current = workspaces.data?.find((w: { id: string }) => w.id === workspaceId);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Переключатель workspace */}
      <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" className="w-full justify-between">
              <span className="truncate">{current?.name ?? 'Выберите workspace'}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            {workspaces.data?.map((w: { id: string; name: string }) => (
              <DropdownMenuItem key={w.id}>
                <a href={`/workspaces/${w.id}`}>{w.name}</a>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem>
              <form
                className="flex items-center gap-2 px-2 py-1"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newName.trim()) {
                    await createWorkspace.mutateAsync(newName.trim());
                    setNewName('');
                  }
                }}
              >
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Новый workspace"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
                <button type="submit" aria-label="Создать">
                  <Plus className="h-4 w-4" />
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Дерево страниц */}
      <nav className="flex-1 overflow-y-auto p-2">
        <PageTree workspaceId={workspaceId} />
      </nav>

      {/* Нижние ссылки: избранное и корзина */}
      <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
        <a
          href={`/workspaces/${workspaceId}/favorites`}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Star className="h-4 w-4" />
          Избранное
        </a>
        <a
          href={`/workspaces/${workspaceId}/trash`}
          className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          <Trash2 className="h-4 w-4" />
          Корзина
        </a>
      </div>
    </aside>
  );
}
