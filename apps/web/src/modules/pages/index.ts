import { createPageRepositoryApi } from './api/page.repository.api';
import type { TokenProvider } from '../../shared/types';
import type { PageRepository } from './types/ports';

export { PageTree } from './ui/public/page-tree';
export { PageHeader } from './ui/public/page-header';
export { FavoritesList } from './ui/public/favorites-list';
export { TrashList } from './ui/public/trash-list';
export { SearchDialog } from './ui/public/search-dialog';
export { usePages } from './hooks/use-pages';
export { editedAgo, shortAgo } from './utils/time-ago';
export type { ShortAgo, ShortAgoUnit } from './utils/time-ago';
export { pageKeys } from './utils/query-keys';
export type { PageNode } from './utils/page';
export {
  assertCanMove,
  buildTree,
  canMove,
  findNode,
  flattenTree,
  isPageId,
  moveInTree,
  normalizePageTitle,
  sortPages,
} from './utils/page';
export type { PageRepository } from './types/ports';

/**
 * Public API of the pages module.
 *
 * Only the factory, facade hooks, and page tree are exposed externally. The repository
 * over the gateway stays internal: `api` is imported strictly within the
 * module, and the container receives only the `PageRepository` port.
 */

export type PagesModule = PageRepository;

export function createPagesModule(deps: { accessToken: TokenProvider }): PageRepository {
  return createPageRepositoryApi(deps.accessToken);
}
