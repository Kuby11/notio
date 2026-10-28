import { createBlockRepositoryApi } from './api/block.repository.api';
import type { TokenProvider } from '../../shared/types';
import type { BlockRepository } from './types/ports';

export { Editor } from './ui/public/editor';
export { useBlockCreator, useEditor } from './hooks/use-editor';
export { editorKeys } from './utils/query-keys';
export {
  DEFAULT_BLOCK_DEFINITIONS,
  blockToText,
  blocksToEditorDocument,
  canMoveBlock,
  createEmptyBlock,
  deserializeDocument,
  editorDocumentToBlocks,
  findBlockIdAtSelection,
  getBlockDefinition,
  listBlockDefinitions,
  registerBlock,
  serializeDocument,
  toEditorText,
} from './utils/block';
export type {
  BlockSelectionLike,
  EditorBlockContent,
  EditorDocument,
  EditorNode,
} from './utils/block';
export { parseMarkdownToBlocks, importTitleFrom } from './utils/markdown-import';
export { SLASH_COMMANDS, filterSlashCommands } from './utils/slash';
export type { SlashCommand, SlashRange } from './utils/slash';
export type { BlockRepository } from './types/ports';

/**
 * Public API of the editor module.
 *
 * The application receives the factory, the facade hooks and the editor
 * component. The block repository is exposed only as a port: the adapter and
 * the DTOs stay inside the module.
 */

export type EditorModule = BlockRepository;

export function createEditorModule(deps: { accessToken: TokenProvider }): BlockRepository {
  return createBlockRepositoryApi(deps.accessToken);
}
