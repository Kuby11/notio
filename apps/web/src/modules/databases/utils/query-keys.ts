/**
 * TanStack Query key factories for the databases module.
 */
export const databaseKeys = {
  all: ['databases'] as const,
  lists: () => [...databaseKeys.all, 'list'] as const,
  list: (workspaceId: string) => [...databaseKeys.lists(), workspaceId] as const,
  details: () => [...databaseKeys.all, 'detail'] as const,
  detail: (id: string) => [...databaseKeys.details(), id] as const,
  rows: (databaseId: string) => [...databaseKeys.detail(databaseId), 'rows'] as const,
  views: (databaseId: string) => [...databaseKeys.detail(databaseId), 'views'] as const,
};
