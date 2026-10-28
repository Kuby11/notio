/**
 * Factory for TanStack Query keys.
 * Keys are built only here: scattered key strings would desynchronize the cache.
 */
export const pageKeys = {
  all: (workspaceId: string) => ['pages', workspaceId] as const,
  children: (workspaceId: string, parentId: string | null) =>
    [...pageKeys.all(workspaceId), 'children', parentId] as const,
  favorites: (workspaceId: string) => [...pageKeys.all(workspaceId), 'favorites'] as const,
  trash: (workspaceId: string) => [...pageKeys.all(workspaceId), 'trash'] as const,
  /** Whole workspace, flat: the library table nests it on the client. */
  flat: (workspaceId: string) => [...pageKeys.all(workspaceId), 'flat'] as const,
  search: (workspaceId: string, query: string) =>
    [...pageKeys.all(workspaceId), 'search', query] as const,
  detail: (workspaceId: string, id: string) =>
    [...pageKeys.all(workspaceId), 'detail', id] as const,
  breadcrumb: (workspaceId: string, id: string) =>
    [...pageKeys.all(workspaceId), 'breadcrumb', id] as const,
};
