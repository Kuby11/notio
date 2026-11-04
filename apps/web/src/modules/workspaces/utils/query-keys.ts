/**
 * TanStack Query key factory.
 * Keys are built only here: scattered key strings desynchronise the cache.
 */
export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  detail: (id: string) => [...workspaceKeys.all, 'detail', id] as const,
  members: (id: string | null) => [...workspaceKeys.all, 'members', id] as const,
  invitations: (id: string) => [...workspaceKeys.all, 'invitations', id] as const,
};
