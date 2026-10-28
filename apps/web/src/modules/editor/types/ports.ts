import type { Block } from '@notio/contracts';

/**
 * Block repository port.
 *
 * The implementation is an adapter over the gateway; facade hooks know only
 * this interface, so tests substitute an in-memory version without network.
 */
export interface BlockRepository {
  listByPage(pageId: string): Promise<Block[]>;
  create(pageId: string, content: Block['content'], afterBlockId?: string): Promise<Block>;
  update(id: string, content: Block['content']): Promise<Block>;
  delete(id: string): Promise<void>;
  move(id: string, afterBlockId?: string): Promise<Block>;
}

/** Input shape for block creation: the minimum of fields for the UI. */
export type CreateBlockFormInput = {
  pageId: string;
  content: Block['content'];
  afterBlockId?: string;
};
