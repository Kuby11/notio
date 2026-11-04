import { useQuery } from '@tanstack/react-query';
import { useContainer } from '../../../core/container';
import { databaseKeys } from '../utils/query-keys';

/**
 * Views of one database for the sidebar tree. Like page children, the query
 * is enabled only for an expanded branch; the database's defaultViewId is
 * enough to know that the expand control belongs on the row.
 */
export function useDatabaseViews(databaseId: string, enabled = true) {
  const { databases } = useContainer();

  return useQuery({
    queryKey: databaseKeys.views(databaseId),
    queryFn: () => databases.getViews(databaseId),
    staleTime: 30_000,
    enabled,
  });
}
