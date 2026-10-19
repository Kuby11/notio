import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { assertSignInCredentials, assertSignUpInput } from '../utils/credentials';
import type { Credentials, SignUpInput } from '../utils/credentials';
import { authKeys } from '../utils/query-keys';

/**
 * Единственный facade-хук модуля аутентификации.
 *
 * Здесь собрана вся оркестрация: запрос сессии, вход, регистрация, OAuth и
 * выход. Компоненты получают готовые операции, доменные правила остаются
 * в `utils`, а сеть — за портом `AuthGateway` из контейнера.
 */
export function useAuth() {
  const { auth } = useContainer();
  const queryClient = useQueryClient();

  const session = useQuery({
    queryKey: authKeys.session(),
    queryFn: () => auth.gateway.currentSession(),
    staleTime: 30_000,
    retry: false,
  });

  const signIn = useMutation({
    mutationFn: (input: Credentials) => auth.gateway.signIn(assertSignInCredentials(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });

  const signInWithProvider = useMutation({
    mutationFn: (provider: 'google' | 'github') => auth.gateway.signInWithProvider(provider),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });

  const signUp = useMutation({
    mutationFn: (input: SignUpInput) => auth.gateway.signUp(assertSignUpInput(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });

  /**
   * Выход из аккаунта.
   *
   * Ошибка сети не превращается в «успешный» выход: иначе интерфейс покажет,
   * что пользователь вышел, хотя cookie осталась и сессия ещё активна.
   */
  const signOut = useMutation({
    mutationFn: () => auth.gateway.signOut(),
    onSuccess: async () => {
      auth.accessToken.clear();
      queryClient.clear();
    },
  });

  return { session, signIn, signInWithProvider, signUp, signOut };
}
