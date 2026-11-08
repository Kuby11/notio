import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { assertSignInCredentials, assertSignUpInput } from '../utils/credentials';
import type { Credentials, SignUpInput } from '../utils/credentials';
import type { AuthSession } from '../types/ports';
import { authKeys } from '../utils/query-keys';

/**
 * The single facade hook of the authentication module.
 *
 * All orchestration lives here: session query, sign-in, registration, OAuth and
 * sign-out. Components get ready-made operations, domain rules stay in
 * `utils`, and the network stays behind the `AuthGateway` port from the container.
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
   * Profile update: the adapter returns the stored user, which becomes the
   * session cache value. The UI then shows exactly what the server persisted
   * instead of waiting for a refetch that may never happen.
   */
  const updateUser = useMutation({
    mutationFn: (input: { name?: string; image?: string | null }) => auth.gateway.updateUser(input),
    onSuccess: (user) => {
      queryClient.setQueryData<AuthSession | null>(authKeys.session(), (previous) =>
        previous === null || previous === undefined ? previous : { ...previous, user },
      );
    },
  });

  const changeEmail = useMutation({
    mutationFn: (newEmail: string) => auth.gateway.changeEmail(newEmail.trim().toLowerCase()),
  });

  const changePassword = useMutation({
    mutationFn: (input: { newPassword: string }) => auth.gateway.changePassword(input),
  });

  /** Account deletion ends the session on the server, so the client state goes with it. */
  const deleteAccount = useMutation({
    mutationFn: () => auth.gateway.deleteAccount(),
    onSuccess: () => {
      auth.accessToken.clear();
      queryClient.clear();
    },
  });

  /**
   * Signing out.
   *
   * A network error must not become a "successful" sign-out: otherwise the UI
   * would show the user as signed out while the cookie remains and the session
   * is still alive.
   */
  const signOut = useMutation({
    mutationFn: () => auth.gateway.signOut(),
    onSuccess: async () => {
      auth.accessToken.clear();
      queryClient.clear();
    },
  });

  return {
    session,
    signIn,
    signInWithProvider,
    signUp,
    updateUser,
    changeEmail,
    changePassword,
    deleteAccount,
    signOut,
  };
}
