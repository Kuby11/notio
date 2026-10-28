import { generateKeyBetween } from 'fractional-indexing';
import type { Bindings } from '../env';
import { ConflictError, NotFoundError } from '../errors';
import { BlockRepository } from '../repositories/block.repository';
import { PageRepository } from '../repositories/page.repository';
import type { Block, CreateBlockInput, UpdateBlockInput } from '@notio/contracts';
import { newId } from '@notio/contracts';

/** The time source is injected so tests do not depend on the system clock. */
export type Clock = () => Date;

export interface BlockListResult {
  items: Block[];
  nextCursor: string | null;
}

/**
 * Scenarios for working with blocks.
 *
 * This layer knows nothing about HTTP: no Request, no Response, no status
 * codes — only domain types and typed errors. Permissions are checked at the
 * page level (the page must exist and not be in the trash).
 */
export class BlockService {
  constructor(
    private readonly blocks: BlockRepository,
    private readonly pages: PageRepository,
    private readonly clock: Clock,
  ) {}

  private now(): string {
    return this.clock().toISOString();
  }

  /** The page must exist and not be in the trash (read is allowed). */
  private async assertPageUsable(pageId: string): Promise<void> {
    const page = await this.pages.findById(pageId);

    if (!page) {
      throw new NotFoundError('Страница не найдена');
    }

    if (page.isTrashed) {
      throw new ConflictError('Нельзя редактировать страницу в корзине');
    }
  }

  /** For writes the page must additionally be unlocked. */
  private async assertPageWritable(pageId: string): Promise<void> {
    const page = await this.pages.findById(pageId);

    if (!page) {
      throw new NotFoundError('Страница не найдена');
    }

    if (page.isTrashed) {
      throw new ConflictError('Нельзя редактировать страницу в корзине');
    }

    if (page.isLocked) {
      throw new ConflictError('Страница заблокирована для редактирования');
    }
  }

  async createBlock(input: CreateBlockInput, _actorId: string): Promise<Block> {
    await this.assertPageWritable(input.pageId);

    const last = await this.blocks.lastBlock(input.pageId);
    const now = this.now();
    const created = await this.blocks.create({
      id: newId(),
      pageId: input.pageId,
      type: input.content.type,
      position: generateKeyBetween(last?.position ?? null, null),
      content: input.content,
      createdAt: now,
      updatedAt: now,
    });

    await this.touchPage(input.pageId, now);

    return created;
  }

  async getPageBlocks(pageId: string): Promise<Block[]> {
    await this.assertPageUsable(pageId);

    return this.blocks.listByPage(pageId);
  }

  async updateBlock(id: string, patch: UpdateBlockInput): Promise<Block> {
    const block = await this.blocks.findById(id);

    if (!block) {
      throw new NotFoundError('Блок не найден');
    }

    await this.assertPageWritable(block.pageId);

    const now = this.now();
    const updated = await this.blocks.updateById(id, patch, now);

    if (!updated) {
      throw new NotFoundError('Блок не найден');
    }

    await this.touchPage(block.pageId, now);

    return updated;
  }

  async deleteBlock(id: string): Promise<void> {
    const block = await this.blocks.findById(id);

    if (!block) {
      throw new NotFoundError('Блок не найден');
    }

    await this.assertPageWritable(block.pageId);

    await this.blocks.deleteById(id);
    await this.touchPage(block.pageId, this.now());
  }

  async moveBlock(id: string, afterBlockId?: string): Promise<Block> {
    const block = await this.blocks.findById(id);

    if (!block) {
      throw new NotFoundError('Блок не найден');
    }

    await this.assertPageWritable(block.pageId);

    let before: string | null = null;
    let after: string | null = null;

    if (afterBlockId !== undefined) {
      const anchor = await this.blocks.findById(afterBlockId);

      if (anchor && anchor.pageId === block.pageId) {
        before = anchor.position;

        const siblings = await this.blocks.listByPage(block.pageId);
        const anchorIndex = siblings.findIndex((sibling) => sibling.id === afterBlockId);

        if (anchorIndex >= 0 && anchorIndex + 1 < siblings.length) {
          after = siblings[anchorIndex + 1]?.position ?? null;
        }
      }
    } else {
      // Move to the end: before = the last block.
      const last = await this.blocks.lastBlock(block.pageId);

      if (last && last.id !== id) {
        before = last.position;
      }
    }

    const updated = await this.blocks.moveById(id, generateKeyBetween(before, after), this.now());

    if (!updated) {
      throw new NotFoundError('Блок не найден');
    }

    await this.touchPage(block.pageId, updated.updatedAt);

    return updated;
  }

  /** Editing content also touches the page itself: record the modification time. */
  private async touchPage(pageId: string, updatedAt: string): Promise<void> {
    await this.pages.touch(pageId, updatedAt);
  }
}

export function createBlockService(env: Bindings, clock: Clock = () => new Date()): BlockService {
  return new BlockService(new BlockRepository(env), new PageRepository(env), clock);
}
