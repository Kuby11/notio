import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import type { AuthError } from '../domain';
import { authKeys } from './query-keys';

/**
 * Хуки аутентификации — единственное место, где UI знает про Query и контейнер.
 * Компоненты получают уже готовые обработчики и не вызывают use case сами.
 */

/** Сессия — серверное состояние, поэтому живёт в TanStack Query, а не в Zustand. */
export function useSession() {
  const { auth } = useContainer();

  return useQuery({
    queryKey: authKeys.session(),
    queryFn: () => auth.currentSession.execute(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSignIn() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { email: string; password: string }) => auth.signIn.execute(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });
}

export function useSignUp() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; email: string; password: string }) =>
      auth.signUp.execute(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });
}

export function useSignOut() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auth.signOut.execute(),
    onSuccess: async () => {
      queryClient.clear();
    },
  });
}

/** Текст ошибки для показа пользователю: коды домена, а не тексты сервера. */
export function authErrorMessage(error: unknown): string | null {
  if (error === null || typeof error !== 'object' || !('code' in error)) {
    return null;
  }

  return (error as AuthError).message;
}
