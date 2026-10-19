'use client';

import { useWorkspaces } from '@/modules/workspaces';
import { FavoritesList, PageTree, TrashList } from '@/modules/pages';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog';
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

type SidebarPanel = 'favorites' | 'trash';

/**
 * Боковая панель: переключатель workspace, дерево страниц, избранное и корзина.
 *
 * Компонент живёт в `core`, потому что собирает несколько модулей вместе.
 * В `shared/ui` ему нельзя: shared не имеет права импортировать modules.
 * Вся работа с данными идёт через facade-хуки модулей, компонент держит
 * только UI-состояние (какой workspace выбран, новое имя, открытая панель).
 */
export function AppSidebar({ workspaceId }: AppSidebarProps) {
  const workspaces = useWorkspaces();
  const [newName, setNewName] = useState('');
  const [panel, setPanel] = useState<SidebarPanel | null>(null);

  const current = workspaces.list.data?.find((workspace) => workspace.id === workspaceId);

  return (
    <>
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
              {workspaces.list.data?.map((workspace) => (
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
                      await workspaces.createWorkspace.mutateAsync(newName.trim());
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

        {/* Нижние панели: избранное и корзина открываются поверх страницы */}
        <div className="border-t border-neutral-200 p-2 dark:border-neutral-800">
          <button
            type="button"
            onClick={() => setPanel('favorites')}
            aria-haspopup="dialog"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Star className="h-4 w-4" />
            Избранное
          </button>
          <button
            type="button"
            onClick={() => setPanel('trash')}
            aria-haspopup="dialog"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Trash2 className="h-4 w-4" />
            Корзина
          </button>
        </div>
      </aside>

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
              <DialogTitle>{panel === 'trash' ? 'Корзина' : 'Избранное'}</DialogTitle>
              <DialogDescription>
                {panel === 'trash'
                  ? 'Удалённые страницы можно восстановить.'
                  : 'Страницы, отмеченные звёздочкой, собраны здесь.'}
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
    </>
  );
}
