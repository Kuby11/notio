import type { Block } from '@notio/contracts';
import type { BlockRepository } from '../../types/ports';

/** Обновление содержимого блока. */
export class UpdateBlock {
  constructor(private readonly blocks: BlockRepository) {}

  execute(id: string, content: Block['content']): Promise<Block> {
    return this.blocks.update(id, content);
  }
}
