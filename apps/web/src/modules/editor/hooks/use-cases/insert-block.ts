import type { Block } from '@notio/contracts';
import type { BlockRepository } from '../../types/ports';

/** Вставка блока после указанного (или в конец, если не указан). */
export class InsertBlock {
  constructor(private readonly blocks: BlockRepository) {}

  execute(pageId: string, content: Block['content'], afterBlockId?: string): Promise<Block> {
    return this.blocks.create(pageId, content, afterBlockId);
  }
}
