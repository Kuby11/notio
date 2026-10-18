import { generateKeyBetween } from 'fractional-indexing';
import type { Bindings } from '../env';
import { ConflictError, NotFoundError } from '../errors';
import { BlockRepository } from '../repositories/block.repository';
import { PageRepository } from '../repositories/page.repository';
import type { Block, CreateBlockInput, UpdateBlockInput } from '@notio/contracts';
import { newId } from '@notio/contracts';

/** Источник времени внедряется, чтобы тесты не зависели от системных часов. */
export type Clock = () => Date;

export interface BlockListResult {
  items: Block[];
  nextCursor: string | null;
}

/**
 * Сценарии работы с блоками.
 *
 * Слой не знает про HTTP: ни Request, ни Response, ни кодов статусов —
 * только доменные типы и типизированные ошибки. Права проверяются
 * на уровне страницы (страница должна существовать и не быть в корзине).
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

  /** Страница должна существовать и не быть в корзине. */
  private async assertPageUsable(pageId: string): Promise<void> {
    const page = await this.pages.findById(pageId);

    if (!page) {
      throw new NotFoundError('Страница не найдена');
    }

    if (page.isTrashed) {
      throw new ConflictError('Нельзя редактировать страницу в корзине');
    }
  }

  async createBlock(input: CreateBlockInput, _actorId: string): Promise<Block> {
    await this.assertPageUsable(input.pageId);

    const last = await this.blocks.lastBlock(input.pageId);
    const now = this.now();

    return this.blocks.create({
      id: newId(),
      pageId: input.pageId,
      type: input.content.type,
      position: generateKeyBetween(last?.position ?? null, null),
      content: input.content,
      createdAt: now,
      updatedAt: now,
    });
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

    const updated = await this.blocks.updateById(id, patch, this.now());

    if (!updated) {
      throw new NotFoundError('Блок не найден');
    }

    return updated;
  }

  async deleteBlock(id: string): Promise<void> {
    const block = await this.blocks.findById(id);

    if (!block) {
      throw new NotFoundError('Блок не найден');
    }

    await this.blocks.deleteById(id);
  }

  async moveBlock(id: string, afterBlockId?: string): Promise<Block> {
    const block = await this.blocks.findById(id);

    if (!block) {
      throw new NotFoundError('Блок не найден');
    }

    await this.assertPageUsable(block.pageId);

    let before: string | null = null;
    let after: string | null = null;

    if (afterBlockId !== undefined) {
      const anchor = await this.blocks.findById(afterBlockId);

      if (anchor && anchor.pageId === block.pageId) {
        before = anchor.position;

        // Находим следующий блок после anchor.
        const siblings = await this.blocks.listByPage(block.pageId);
        const anchorIndex = siblings.findIndex((sibling) => sibling.id === afterBlockId);

        if (anchorIndex >= 0 && anchorIndex + 1 < siblings.length) {
          after = siblings[anchorIndex + 1]?.position ?? null;
        }
      }
    } else {
      // Перемещение в конец: before = последний блок.
      const last = await this.blocks.lastBlock(block.pageId);

      if (last && last.id !== id) {
        before = last.position;
      }
    }

    const updated = await this.blocks.moveById(id, generateKeyBetween(before, after), this.now());

    if (!updated) {
      throw new NotFoundError('Блок не найден');
    }

    return updated;
  }
}

/** Собирает сервис со всеми зависимостями. */
export function createBlockService(env: Bindings, clock: Clock = () => new Date()): BlockService {
  return new BlockService(new BlockRepository(env), new PageRepository(env), clock);
}
