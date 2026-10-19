/**
 * Фабрика ключей TanStack Query.
 * Ключи собираются только здесь: разбросанные строки ключей рассинхронизируют кеш.
 */
export const workspaceKeys = {
  all: ['workspaces'] as const,
  list: () => [...workspaceKeys.all, 'list'] as const,
  detail: (id: string) => [...workspaceKeys.all, 'detail', id] as const,
  members: (id: string) => [...workspaceKeys.all, 'members', id] as const,
  invitations: (id: string) => [...workspaceKeys.all, 'invitations', id] as const,
};
