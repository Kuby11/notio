/**
 * Фабрики ключей TanStack Query.
 * Ключи собираются только здесь: разбросанные строки ключей рассинхронизируют кеш.
 */
export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};
