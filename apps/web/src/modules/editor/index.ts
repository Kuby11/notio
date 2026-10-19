import { createBlockRepositoryApi } from './api/block.repository.api';
import type { TokenProvider } from '../../shared/types';
import type { BlockRepository } from './types/ports';

export { Editor } from './ui/public/editor';
export { useEditor } from './hooks/use-editor';
export { editorKeys } from './utils/query-keys';
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
export type { BlockRepository } from './types/ports';

/**
 * Публичный API модуля редактора.
 *
 * Приложение получает фабрику, facade-хуки и компонент редактора.
 * Репозиторий блоков отдаётся только как порт: адаптер и DTO остаются
 * внутри модуля.
 */

export type EditorModule = BlockRepository;

export function createEditorModule(deps: { accessToken: TokenProvider }): BlockRepository {
  return createBlockRepositoryApi(deps.accessToken);
}
