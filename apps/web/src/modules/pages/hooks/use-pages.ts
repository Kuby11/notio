import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { usePageTreeStore } from '../stores/page-tree.store';
import type { CreatePageFormInput } from '../types/ports';
import { assertCanMove, normalizePageTitle, type PageNode } from '../utils/page';
import { pageKeys } from './query-keys';

/**
 * Хуки страниц: TanStack Query — единственный источник серверного состояния.
 * Оптимистичные обновления с откатом живут в мутациях, а не в Zustand.
 *
 * Бизнес-правила (перемещение, заголовок по умолчанию) берутся из `utils`,
 * репозиторий приходит из контейнера, а компоненты не знают ни о том, ни
 * о другом. Стейт дерева (раскрытые узлы) хранится в Zustand-сторе модуля,
 * но наружу — в том числе другим модулям — отдаётся только через facade-хук
 * `usePageTreeState`. Прямой импорт стора за пределами модуля запрещён.
 */

/** Facade над UI-состоянием дерева: единственная публичная точка входа. */
export function usePageTreeState() {
  const expanded = usePageTreeStore((state) => state.expanded);
  const toggle = usePageTreeStore((state) => state.toggle);
  const setExpanded = usePageTreeStore((state) => state.setExpanded);
  const reset = usePageTreeStore((state) => state.reset);

  return { expanded, toggle, setExpanded, reset };
}

export function usePageChildren(workspaceId: string, parentId: string | null) {
  const { pages } = useContainer();

  return useQuery({
    queryKey: pageKeys.children(workspaceId, parentId),
    queryFn: () => pages.listChildren(workspaceId, parentId, false),
    staleTime: 30_000,
  });
}

export function useCreatePage() {
  const { pages } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
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
}

export function useMovePage() {
  const { pages } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
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
    onError: (_error, _input, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(
          pageKeys.children(_input.workspaceId, _input.newParentId),
          context.snapshot,
        );
      }
    },
    onSettled: async (_data, _error, input) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(input.workspaceId) });
    },
  });
}

export function useRenamePage() {
  const { pages } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workspaceId, title }: { id: string; workspaceId: string; title: string }) =>
      pages.update(id, workspaceId, { title: normalizePageTitle(title) }),
    onMutate: async ({ id, workspaceId, title }) => {
      await queryClient.cancelQueries({ queryKey: pageKeys.all(workspaceId) });
      const previous = queryClient.getQueryData(pageKeys.children(workspaceId, null));

      // Оптимистичное обновление: показываем новое имя сразу.
      queryClient.setQueryData(pageKeys.children(workspaceId, null), (old: unknown) => {
        if (!Array.isArray(old)) {
          return old;
        }

        return old.map((page: { id: string; title: string }) =>
          page.id === id ? { ...page, title } : page,
        );
      });

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(pageKeys.children(_variables.workspaceId, null), context.previous);
      }
    },
    onSettled: async (_data, _error, variables) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(variables.workspaceId) });
    },
  });
}

export function useTrashPage() {
  const { pages } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workspaceId }: { id: string; workspaceId: string }) =>
      pages.update(id, workspaceId, { isTrashed: true }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });
}

export function useRestorePage() {
  const { pages } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, workspaceId }: { id: string; workspaceId: string }) =>
      pages.update(id, workspaceId, { isTrashed: false }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });
}

export function useToggleFavorite() {
  const { pages } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      workspaceId,
      isFavorite,
    }: {
      id: string;
      workspaceId: string;
      isFavorite: boolean;
    }) => pages.update(id, workspaceId, { isFavorite }),
    onSuccess: async (page) => {
      await queryClient.invalidateQueries({ queryKey: pageKeys.all(page.workspaceId) });
    },
  });
}
