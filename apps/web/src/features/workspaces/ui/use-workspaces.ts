import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { workspaceKeys } from './query-keys';

export { workspaceKeys } from './query-keys';

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
    mutationFn: (name: string) => workspaces.create(name),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.list() });
    },
  });
}

export function useRenameWorkspace() {
  const { workspaces } = useContainer();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => workspaces.rename(id, name),
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
