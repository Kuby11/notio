import { createPageRepositoryApi } from './api/page.repository.api';
import { CreatePage } from './hooks/use-cases/create-page';
import { ListChildren } from './hooks/use-cases/list-children';
import { MovePage } from './hooks/use-cases/move-page';
import { RenamePage } from './hooks/use-cases/rename-page';
import { RestorePage } from './hooks/use-cases/restore-page';
import { ToggleFavorite } from './hooks/use-cases/toggle-favorite';
import { TrashPage } from './hooks/use-cases/trash-page';
import type { TokenProvider } from '../../shared/types';

export { PageTree } from './ui/public/page-tree';
export {
  useCreatePage,
  useMovePage,
  usePageChildren,
  usePageTreeState,
  useRenamePage,
  useToggleFavorite,
  useTrashPage,
} from './hooks/use-pages';
export { pageKeys } from './hooks/query-keys';
export type { PageNode } from './utils/page';
export {
  buildTree,
  canMove,
  findNode,
  flattenTree,
  isPageId,
  moveInTree,
  sortPages,
} from './utils/page';
export type { Clock, PageRepository } from './types/ports';
export { systemClock } from './types/ports';

/**
 * Публичный API модуля страниц.
 *
 * Другие модули и приложение видят только фабрику, facade-хуки и дерево
 * страниц. Репозиторий поверх gateway и use cases остаются внутренними:
 * `api` импортируется строго внутри модуля.
 */

export interface PagesModule {
  createPage: CreatePage;
  listChildren: ListChildren;
  movePage: MovePage;
  renamePage: RenamePage;
  trashPage: TrashPage;
  restorePage: RestorePage;
  toggleFavorite: ToggleFavorite;
}

export function createPagesModule(deps: { accessToken: TokenProvider }): PagesModule {
  const repository = createPageRepositoryApi(deps.accessToken);

  return {
    createPage: new CreatePage(repository),
    listChildren: new ListChildren(repository),
    movePage: new MovePage(repository),
    renamePage: new RenamePage(repository),
    trashPage: new TrashPage(repository),
    restorePage: new RestorePage(repository),
    toggleFavorite: new ToggleFavorite(repository),
  };
}
