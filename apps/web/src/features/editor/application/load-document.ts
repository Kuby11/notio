import type { Block } from '@notio/contracts';
import type { BlockRepository } from './ports';

/** Загрузка документа: список блоков страницы. */
export class LoadDocument {
  constructor(private readonly blocks: BlockRepository) {}

  execute(pageId: string): Promise<Block[]> {
    return this.blocks.listByPage(pageId);
  }
}
