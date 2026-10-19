/**
 * Фабрика ключей TanStack Query.
 * Ключи собираются только здесь: разбросанные строки ключей рассинхронизируют кеш.
 */
export const pageKeys = {
  all: (workspaceId: string) => ['pages', workspaceId] as const,
  children: (workspaceId: string, parentId: string | null) =>
    [...pageKeys.all(workspaceId), 'children', parentId] as const,
  favorites: (workspaceId: string) => [...pageKeys.all(workspaceId), 'favorites'] as const,
  trash: (workspaceId: string) => [...pageKeys.all(workspaceId), 'trash'] as const,
  detail: (workspaceId: string, id: string) =>
    [...pageKeys.all(workspaceId), 'detail', id] as const,
};
