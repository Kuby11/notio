/**
 * TanStack Query key factories.
 * Keys are built only here: scattered key strings desynchronise the cache.
 */
export const authKeys = {
  all: ['auth'] as const,
  session: () => [...authKeys.all, 'session'] as const,
};
