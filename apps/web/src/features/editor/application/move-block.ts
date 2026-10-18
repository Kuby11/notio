import type { BlockRepository } from './ports';

/** Перемещение блока после указанного (или в конец). */
export class MoveBlock {
  constructor(private readonly blocks: BlockRepository) {}

  execute(id: string, afterBlockId?: string): Promise<unknown> {
    return this.blocks.move(id, afterBlockId);
  }
}
