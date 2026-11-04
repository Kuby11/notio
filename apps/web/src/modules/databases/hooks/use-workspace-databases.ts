import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Database } from '@notio/contracts';
import { useContainer } from '../../../core/container';
import { databaseKeys } from '../utils/query-keys';

/**
 * Databases of a workspace: the list for the sidebar tree plus creation and
 * soft deletion (isTrashed). Separate from the single-database hook because the
 * tree renders outside any open database.
 */
export function useWorkspaceDatabases(workspaceId: string) {
  const { databases } = useContainer();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: databaseKeys.list(workspaceId),
    queryFn: () => databases.list(workspaceId),
    staleTime: 30_000,
  });

  const createDatabase = useMutation({
    mutationFn: (title: string) =>
      databases.create({ workspaceId, parentId: null, title, isInline: false }),
    onSuccess: (created) => {
      queryClient.setQueryData<Database[]>(databaseKeys.list(workspaceId), (old = []) => [
        ...old,
        created,
      ]);
    },
  });

  const deleteDatabase = useMutation({
    mutationFn: (id: string) => databases.update(id, { isTrashed: true }),
    onSuccess: (deleted) => {
      queryClient.setQueryData<Database[]>(databaseKeys.list(workspaceId), (old = []) =>
        (old ?? []).filter((item) => item.id !== deleted.id),
      );
    },
  });

  return {
    items: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    isError: listQuery.isError,
    createDatabase,
    deleteDatabase,
  };
}
