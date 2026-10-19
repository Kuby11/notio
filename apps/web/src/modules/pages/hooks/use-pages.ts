import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { usePageTreeStore } from '../stores/page-tree.store';
import type { CreatePageFormInput } from '../types/ports';
import { assertCanMove, normalizePageTitle, type PageNode } from '../utils/page';
import { pageKeys } from '../utils/query-keys';

/** Что именно показывает экран: уровень дерева, избранное или корзина. */
export type PagesScope = 'tree' | 'favorites' | 'trash';

/**
 * Единственный facade-хук модуля страниц.
 *
 * Хук оркестрирует всё состояние модуля: раскрытые узлы из приватного стора,
 * загрузку детей и мутации с оптимистичными обновлениями. `workspaceId` и
 * `parentId` задают уровень дерева, поэтому рекурсивный `PageTree` вызывает
 * тот же хук для каждой ветки. `scope: 'favorites'` переключает источник
 * данных на плоский список избранного по всему workspace.
 * `scope: 'trash'` — на корзину.
 *
 * Бизнес-правила (перемещение, заголовок по умолчанию) берутся из `utils`,
 * репозиторий приходит из контейнера, а компоненты не знают ни о том, ни
 * о другом. Стейт дерева наружу отдаётся только этим хуком.
 */
export function usePages(
  workspaceId: string,
  parentId: string | null = null,
  scope: PagesScope = 'tree',
) {
  const { pages } = useContainer();
  const queryClient = useQueryClient();
  const expanded = usePageTreeStore((state) => state.expanded);
  const toggle = usePageTreeStore((state) => state.toggle);
  const setExpanded = usePageTreeStore((state) => state.setExpanded);
  const reset = usePageTreeStore((state) => state.reset);

  const children = useQuery({
    queryKey: pageKeys.children(workspaceId, parentId),
    queryFn: () => pages.listChildren(workspaceId, parentId, false),
    staleTime: 30_000,
    enabled: scope === 'tree',
  });

  const favorites = useQuery({
    queryKey: pageKeys.favorites(workspaceId),
    queryFn: () => pages.listFavorites(workspaceId),
    staleTime: 30_000,
    enabled: scope === 'favorites',
  });

  const trash = useQuery({
    queryKey: pageKeys.trash(workspaceId),
    queryFn: () => pages.listTrashed(workspaceId),
    staleTime: 30_000,
    enabled: scope === 'trash',
  });

  const createPage = useMutation({
    mutationFn: (input: CreatePageFormInput) =>
      pages.create({
        workspaceId: input.workspaceId,
        parentId: input.parentId ?? null,
        title: input.title ?? '',
        icon: input.icon,
      }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });

  const movePage = useMutation({
    mutationFn: (input: {
      pageId: string;
      workspaceId: string;
      newParentId: string | null;
      afterPageId?: string;
      tree: readonly PageNode[];
    }) => {
      assertCanMove(input.tree, input.pageId, input.newParentId);

      return pages.move(input.pageId, input.workspaceId, {
        parentId: input.newParentId,
        afterPageId: input.afterPageId,
      });
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: pageKeys.all(input.workspaceId) });

      return {
        snapshot: queryClient.getQueryData(pageKeys.children(input.workspaceId, input.newParentId)),
      };
    },
    onError: (_error, input, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(
          pageKeys.children(input.workspaceId, input.newParentId),
          context.snapshot,
        );
      }
    },
    onSettled: async (_data, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(input.workspaceId) });
    },
  });

  const renamePage = useMutation({
    mutationFn: ({
      id,
      workspaceId: targetWorkspaceId,
      title,
    }: {
      id: string;
      workspaceId: string;
      title: string;
    }) => pages.update(id, targetWorkspaceId, { title: normalizePageTitle(title) }),
    onMutate: async ({ id, workspaceId: targetWorkspaceId, title }) => {
      await queryClient.cancelQueries({ queryKey: pageKeys.all(targetWorkspaceId) });
      const previous = queryClient.getQueryData(pageKeys.children(targetWorkspaceId, null));

      // Оптимистичное обновление: показываем новое имя сразу.
      queryClient.setQueryData(pageKeys.children(targetWorkspaceId, null), (old: unknown) => {
        if (!Array.isArray(old)) {
          return old;
        }

        return old.map((page: { id: string; title: string }) =>
          page.id === id ? { ...page, title } : page,
        );
      });

      return { previous };
    },
    onError: (_error, variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(pageKeys.children(variables.workspaceId, null), context.previous);
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(variables.workspaceId) });
    },
  });

  const trashPage = useMutation({
    mutationFn: ({ id, workspaceId: targetWorkspaceId }: { id: string; workspaceId: string }) =>
      pages.update(id, targetWorkspaceId, { isTrashed: true }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });

  const restorePage = useMutation({
    mutationFn: ({ id, workspaceId: targetWorkspaceId }: { id: string; workspaceId: string }) =>
      pages.update(id, targetWorkspaceId, { isTrashed: false }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: ({
      id,
      workspaceId: targetWorkspaceId,
      isFavorite,
    }: {
      id: string;
      workspaceId: string;
      isFavorite: boolean;
    }) => pages.update(id, targetWorkspaceId, { isFavorite }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });

  return {
    expanded,
    toggle,
    setExpanded,
    reset,
    children,
    favorites,
    trash,
    createPage,
    movePage,
    renamePage,
    trashPage,
    restorePage,
    toggleFavorite,
  };
}
