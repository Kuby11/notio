'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { shouldRetryQuery } from '../shared/configs/query-policy';
import { Toaster } from '../shared/ui/toast';
import { ContainerProvider } from './container';
import { usePreferencesStore } from './preferences/preferences.store';

/**
 * Application providers: the query client and the dependency-injection container.
 * The defaults are set once here rather than in every hook.
 */

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: shouldRetryQuery,
      },
    },
  });
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  // Preferences live in localStorage: read once, after mount, so server and
  // client render the same defaults first.
  useEffect(() => {
    usePreferencesStore.getState().hydrate();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ContainerProvider>
        {children}
        <Toaster />
      </ContainerProvider>
    </QueryClientProvider>
  );
}
