import { createPageRepositoryApi } from './api/page.repository.api';
import type { TokenProvider } from '../../shared/types';
import type { PageRepository } from './types/ports';

export { PageTree } from './ui/public/page-tree';
export {
  useCreatePage,
  useMovePage,
  usePageChildren,
  usePageTreeState,
  useRenamePage,
  useRestorePage,
  useToggleFavorite,
  useTrashPage,
} from './hooks/use-pages';
export { pageKeys } from './hooks/query-keys';
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
 * Публичный API модуля страниц.
 *
 * Наружу выходят только фабрика, facade-хуки и дерево страниц. Репозиторий
 * поверх gateway остаётся внутренним: `api` импортируется строго внутри
 * модуля, а контейнер получает лишь порт `PageRepository`.
 */

export type PagesModule = PageRepository;

export function createPagesModule(deps: { accessToken: TokenProvider }): PageRepository {
  return createPageRepositoryApi(deps.accessToken);
}
