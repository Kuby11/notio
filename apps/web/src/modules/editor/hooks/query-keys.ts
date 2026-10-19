/**
 * Фабрики ключей TanStack Query.
 * Ключи собираются только здесь: разбросанные строки ключей рассинхронизируют кеш.
 */
export const editorKeys = {
  /** Корень кеша редактора: инвалидация всех документов, когда pageId неизвестен. */
  root: ['editor'] as const,
  all: (pageId: string) => [...editorKeys.root, pageId] as const,
  document: (pageId: string) => [...editorKeys.all(pageId), 'document'] as const,
};
