import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import type { WorkspaceRole } from '../types/ports';
import { assertWorkspaceName } from '../utils/rules';
import { workspaceKeys } from '../utils/query-keys';

/**
 * Единственный facade-хук модуля рабочих пространств.
 *
 * Список и участники — серверное состояние TanStack Query, правила
 * (непустое название) — в `utils`, обращения к сервису — через порт из
 * контейнера. Если `workspaceId` не передан, запрос участников выключен:
 * сайдбару достаточно списка workspace.
 */
export function useWorkspaces(workspaceId?: string) {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: workspaceKeys.list(),
    queryFn: () => workspaces.list(),
    staleTime: 60_000,
  });

  const members = useQuery({
    queryKey: workspaceKeys.members(workspaceId ?? null),
    queryFn: () => {
      if (workspaceId === undefined) {
        throw new Error('workspaceId обязателен для загрузки участников');
      }

      return workspaces.listMembers(workspaceId);
    },
    enabled: workspaceId !== undefined,
    staleTime: 30_000,
  });

  const createWorkspace = useMutation({
    mutationFn: (name: string) => workspaces.create(assertWorkspaceName(name)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });

  const renameWorkspace = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      workspaces.rename(id, assertWorkspaceName(name)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });

  const archiveWorkspace = useMutation({
    mutationFn: (id: string) => workspaces.archive(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });

  const createInvitation = useMutation({
    mutationFn: ({ workspaceId: id, role }: { workspaceId: string; role: 'editor' | 'viewer' }) =>
      workspaces.createInvitation(id, role),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(variables.workspaceId),
      });
    },
  });

  const changeMemberRole = useMutation({
    mutationFn: ({
      workspaceId: id,
      userId,
      role,
    }: {
      workspaceId: string;
      userId: string;
      role: WorkspaceRole;
    }) => workspaces.changeRole(id, userId, role),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      });
    },
  });

  const removeMember = useMutation({
    mutationFn: ({ workspaceId: id, userId }: { workspaceId: string; userId: string }) =>
      workspaces.removeMember(id, userId),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.members(variables.workspaceId),
      });
    },
  });

  const revokeInvitation = useMutation({
    mutationFn: ({ workspaceId: id, token }: { workspaceId: string; token: string }) =>
      workspaces.revokeInvitation(id, token),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({
        queryKey: workspaceKeys.invitations(variables.workspaceId),
      });
    },
  });

  const acceptInvitation = useMutation({
    mutationFn: (token: string) => workspaces.acceptInvitation(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });

  return {
    list,
    members,
    createWorkspace,
    renameWorkspace,
    archiveWorkspace,
    createInvitation,
    changeMemberRole,
    removeMember,
    revokeInvitation,
    acceptInvitation,
  };
}
