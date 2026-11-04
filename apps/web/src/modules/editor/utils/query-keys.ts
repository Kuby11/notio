/**
 * TanStack Query key factories.
 * Keys are built only here: scattered key strings desynchronise the cache.
 */
export const editorKeys = {
  /** Editor cache root: invalidates every document when the pageId is unknown. */
  root: ['editor'] as const,
  all: (pageId: string) => [...editorKeys.root, pageId] as const,
  document: (pageId: string) => [...editorKeys.all(pageId), 'document'] as const,
};
