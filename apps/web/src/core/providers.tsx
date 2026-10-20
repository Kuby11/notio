'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { shouldRetryQuery } from '../shared/configs/query-policy';
import { ContainerProvider } from './container';

/**
 * Провайдеры приложения: клиент запросов и контейнер внедрения зависимостей.
 * Значения по умолчанию задаются один раз здесь, а не в каждом хуке.
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

  return (
    <QueryClientProvider client={queryClient}>
      <ContainerProvider>{children}</ContainerProvider>
    </QueryClientProvider>
  );
}
