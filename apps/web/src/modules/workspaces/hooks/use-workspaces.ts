import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import type { WorkspaceRole } from '../types/ports';
import { assertWorkspaceName } from '../utils/rules';
import { workspaceKeys } from './query-keys';

export { workspaceKeys } from './query-keys';

/**
 * Хуки рабочих пространств: серверное состояние — TanStack Query
 * (`hooks/query-keys.ts`), правила (непустое название) — в `utils`,
 * обращения к сервису — через порт из контейнера.
 * Компоненты видят только эти хуки.
 */

export function useWorkspaces() {
  const { workspaces } = useContainer();

  return useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => workspaces.list(),
    staleTime: 60_000,
  });
}

export function useCreateWorkspace() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => workspaces.create(assertWorkspaceName(name)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useRenameWorkspace() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      workspaces.rename(id, assertWorkspaceName(name)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useArchiveWorkspace() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workspaces.archive(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useMembers(workspaceId: string) {
  const { workspaces } = useContainer();

  return useQuery({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => workspaces.listMembers(workspaceId),
    staleTime: 30_000,
  });
}

export function useCreateInvitation() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, role }: { workspaceId: string; role: 'editor' | 'viewer' }) =>
      workspaces.createInvitation(workspaceId, role),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(variables.workspaceId),
      });
    },
  });
}

export function useChangeMemberRole() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      role,
    }: {
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
    }) => workspaces.changeRole(workspaceId, userId, role),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      });
    },
  });
}

export function useRemoveMember() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId: string }) =>
      workspaces.removeMember(workspaceId, userId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      });
    },
  });
}

export function useRevokeInvitation() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workspaceId, token }: { workspaceId: string; token: string }) =>
      workspaces.revokeInvitation(workspaceId, token),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(variables.workspaceId),
      });
    },
  });
}

export function useAcceptInvitation() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (token: string) => workspaces.acceptInvitation(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}
