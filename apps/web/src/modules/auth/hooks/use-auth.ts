import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { isAuthError } from '../types/errors';
import { assertSignInCredentials, assertSignUpInput } from '../utils/credentials';
import type { Credentials, SignUpInput } from '../utils/credentials';
import { authKeys } from './query-keys';

/**
 * Хуки аутентификации — единственное место, где UI знает про Query и контейнер.
 *
 * Компоненты получают уже готовые обработчики: бизнес-правила (нормализация,
 * проверка данных) берутся из `utils`, запрос идёт через порт из контейнера.
 */

/** Сессия — серверное состояние, поэтому живёт в TanStack Query, а не в Zustand. */
export function useSession() {
  const { auth } = useContainer();

  return useQuery({
    queryKey: authKeys.session(),
    queryFn: () => auth.gateway.currentSession(),
    staleTime: 30_000,
    retry: false,
  });
}

export function useSignIn() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Credentials) => auth.gateway.signIn(assertSignInCredentials(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });
}

export function useSignInWithProvider() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (provider: 'google' | 'github') => auth.gateway.signInWithProvider(provider),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });
}

export function useSignUp() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SignUpInput) => auth.gateway.signUp(assertSignUpInput(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });
}

/**
 * Выход из аккаунта.
 *
 * Ошибка сети не превращается в «успешный» выход: иначе интерфейс покажет,
 * что пользователь вышел, хотя cookie осталась и сессия ещё активна.
 */
export function useSignOut() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => auth.gateway.signOut(),
    onSuccess: async () => {
      auth.accessToken.clear();
      queryClient.clear();
    },
  });
}

/** Текст ошибки для показа пользователю: коды домена, а не тексты сервера. */
export function authErrorMessage(error: unknown): string | null {
  if (isAuthError(error)) {
    return error.message;
  }

  return null;
}
