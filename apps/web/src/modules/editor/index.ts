import { createBlockRepositoryApi } from './api/block.repository.api';
import { DeleteBlock } from './hooks/use-cases/delete-block';
import { InsertBlock } from './hooks/use-cases/insert-block';
import { LoadDocument } from './hooks/use-cases/load-document';
import { MoveBlock } from './hooks/use-cases/move-block';
import { UpdateBlock } from './hooks/use-cases/update-block';
import type { TokenProvider } from '../../shared/types';

export { Editor } from './ui/public/editor';
export {
  editorKeys,
  useCreateBlock,
  useDeleteBlock,
  useDocument,
  useEditorUi,
  useUpdateBlock,
} from './hooks/use-editor';
export {
  blockToText,
  canMoveBlock,
  createEmptyBlock,
  deserializeDocument,
  getBlockDefinition,
  listBlockDefinitions,
  registerBlock,
  serializeDocument,
  toEditorText,
} from './utils/block';
export type { BlockRepository, Clock } from './types/ports';
export { systemClock } from './types/ports';

/**
 * Публичный API модуля редактора.
 *
 * Приложение получает фабрику, facade-хуки и компонент редактора.
 * Репозиторий блоков и DTO остаются внутри: `api` не экспортируется.
 */

export interface EditorModule {
  loadDocument: LoadDocument;
  insertBlock: InsertBlock;
  updateBlock: UpdateBlock;
  deleteBlock: DeleteBlock;
  moveBlock: MoveBlock;
}

export function createEditorModule(deps: { accessToken: TokenProvider }): EditorModule {
  const repository = createBlockRepositoryApi(deps.accessToken);

  return {
    loadDocument: new LoadDocument(repository),
    insertBlock: new InsertBlock(repository),
    updateBlock: new UpdateBlock(repository),
    deleteBlock: new DeleteBlock(repository),
    moveBlock: new MoveBlock(repository),
  };
}
