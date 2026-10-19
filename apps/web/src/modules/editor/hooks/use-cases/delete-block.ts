import type { BlockRepository } from '../../types/ports';

/** Удаление блока. */
export class DeleteBlock {
  constructor(private readonly blocks: BlockRepository) {}

  execute(id: string): Promise<void> {
    return this.blocks.delete(id);
  }
}
