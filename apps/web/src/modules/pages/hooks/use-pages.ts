import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { usePageTreeStore } from '../stores/page-tree.store';
import type { CreatePageFormInput } from '../types/ports';
import type { Page, UpdatePageInput } from '@notio/contracts';
import { assertCanMove, normalizePageTitle, type PageNode } from '../utils/page';
import { pageKeys } from '../utils/query-keys';

/** What the screen shows: tree level, favorites, trash, or search results. */
export type PagesScope =
  | 'tree'
  | 'favorites'
  | 'trash'
  | 'page'
  | 'breadcrumb'
  | 'search'
  /** Whole workspace in one flat list: the library table nests it on the client. */
  | 'all';

/**
 * The single facade hook of the pages module.
 *
 * The hook orchestrates all module state: expanded nodes from the private store,
 * loading children and mutations with optimistic updates. `workspaceId` and
 * `parentId` define the tree level, so the recursive `PageTree` calls the
 * same hook for each branch. `scope: 'favorites'` switches the data source
 * to a flat list of favorites across the workspace.
 * `scope: 'trash'` switches to the trash.
 *
 * Business rules (move, default title) come from `utils`,
 * the repository comes from the container, and components know neither
 * of the others. Tree state is exposed only through this hook.
 *
 * `scope: 'search'` runs a title search for `options.q` across the workspace:
 * the query stays disabled while the text is empty, so an idle dialog
 * never hits the network.
 */
export function usePages(
  workspaceId: string,
  parentId: string | null = null,
  scope: PagesScope = 'tree',
  options: { enabled?: boolean; q?: string } = {},
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
    // Children of a collapsed node are not fetched: hasChildren from the list already
    // tells whether the expand button is needed.
    enabled: scope === 'tree' && (options.enabled ?? true),
  });

  // Detailed page and ancestor chain for breadcrumbs/header:
  // parentId is used as the current page id in these scopes. Polling every
  // 30 seconds picks up content change time: block autosave does not
  // invalidate page queries, and updating the whole tree on every
  // typing pause is too expensive.
  const pageDetail = useQuery({
    queryKey: pageKeys.detail(workspaceId, parentId ?? ''),
    queryFn: () => pages.getPage(parentId ?? '', workspaceId),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: scope === 'page' || scope === 'breadcrumb',
  });

  const breadcrumb = useQuery({
    queryKey: pageKeys.breadcrumb(workspaceId, parentId ?? ''),
    queryFn: async () => {
      // Climb up to root; cycle protection in case of invalid data.
      const chain: Page[] = [];
      let current = await pages.getPage(parentId ?? '', workspaceId);
      chain.push(current);

      for (let guard = 0; current.parentId && guard < 20; guard += 1) {
        current = await pages.getPage(current.parentId, workspaceId);
        chain.unshift(current);
      }

      return chain;
    },
    staleTime: 30_000,
    enabled: scope === 'breadcrumb',
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

  const allPages = useQuery({
    queryKey: pageKeys.flat(workspaceId),
    queryFn: () => pages.listAll(workspaceId),
    staleTime: 30_000,
    enabled: scope === 'all',
  });

  const searchText = (options.q ?? '').trim();
  const search = useQuery({
    queryKey: pageKeys.search(workspaceId, searchText),
    queryFn: () => pages.search(workspaceId, searchText),
    staleTime: 15_000,
    enabled: scope === 'search' && (options.enabled ?? true) && searchText.length > 0,
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

  const duplicatePage = useMutation({
    mutationFn: ({ id, workspaceId: targetWorkspaceId }: { id: string; workspaceId: string }) =>
      pages.duplicate(id, targetWorkspaceId),
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

      // Optimistic update: show the new name immediately.
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

  // Generic update for flags without custom business logic
  // (e.g., page locking): invalidation updates the tree,
  // header, and editor reading the same detail key.
  const updatePage = useMutation({
    mutationFn: ({
      id,
      workspaceId: targetWorkspaceId,
      patch,
    }: {
      id: string;
      workspaceId: string;
      patch: UpdatePageInput;
    }) => pages.update(id, targetWorkspaceId, patch),
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
    pageDetail,
    breadcrumb,
    favorites,
    trash,
    allPages,
    search,
    createPage,
    duplicatePage,
    movePage,
    renamePage,
    trashPage,
    restorePage,
    toggleFavorite,
    updatePage,
  };
}
