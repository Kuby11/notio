import { createDatabaseRepositoryApi } from './api/database.api';
import type { TokenProvider } from '../../shared/types';
import type { DatabaseRepository } from './types/ports';

export { useDatabases } from './hooks/use-databases';
export { useDatabaseViews } from './hooks/use-database-views';
export { useWorkspaceDatabases } from './hooks/use-workspace-databases';
export { DatabaseView } from './ui/public/database-view';
export { DatabasesTree } from './ui/public/databases-tree';
export { databaseKeys } from './utils/query-keys';
export {
  assertValidDatabaseTitle,
  assertValidPropertyName,
  findTitleProperty,
} from './utils/rules';
export type { DatabaseRepository } from './types/ports';
export type * from './types';

export type DatabasesModule = DatabaseRepository;

export function createDatabasesModule(deps: { accessToken: TokenProvider }): DatabaseRepository {
  return createDatabaseRepositoryApi(deps.accessToken);
}
