'use client';

import { useCreateWorkspace, useWorkspaces } from '@/modules/workspaces';
import { PageTree } from '@/modules/pages';
import { Button } from '@/shared/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu';
import { ChevronDown, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface AppSidebarProps {
  workspaceId: string;
}

/**
 * Боковая панель: переключатель workspace, дерево страниц, избранное и корзина.
 *
 * Компонент живёт в `core`, потому что собирает несколько модулей вместе.
 * В `shared/ui` ему нельзя: shared не имеет права импортировать modules.
 * Вся работа с данными идёт через facade-хуки модулей, компонент держит
 * только UI-состояние (какой workspace выбран, новое имя).
 */
export function AppSidebar({ workspaceId }: AppSidebarProps) {
  const workspaces = useWorkspaces();
  const createWorkspace = useCreateWorkspace();
  const [newName, setNewName] = useState('');

  const current = workspaces.data?.find((workspace) => workspace.id === workspaceId);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
      {/* Переключатель workspace */}
      <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="w-full justify-between">
                <span className="truncate">{current?.name ?? 'Выберите workspace'}</span>
                <ChevronDown className="h-4 w-4 opacity-50" />
              </Button>
            }
          />
          <DropdownMenuContent className="w-56">
            {workspaces.data?.map((workspace) => (
              <DropdownMenuItem key={workspace.id}>
                <a href={`/workspaces/${workspace.id}`}>{workspace.name}</a>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem>
              <form
                className="flex items-center gap-2 px-2 py-1"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (newName.trim()) {
                    await createWorkspace.mutateAsync(newName.trim());
                    setNewName('');
                  }
                }}
              >
                <input
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
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
