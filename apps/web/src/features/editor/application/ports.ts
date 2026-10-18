import type { Block } from '@notio/contracts';

/**
 * Порт репозитория блоков.
 *
 * Реализация — адаптер поверх gateway; use cases знают только этот интерфейс,
 * поэтому в тестах подставляется in-memory версия без сети.
 */
export interface BlockRepository {
  listByPage(pageId: string): Promise<Block[]>;
  create(pageId: string, content: Block['content'], afterBlockId?: string): Promise<Block>;
  update(id: string, content: Block['content']): Promise<Block>;
  delete(id: string): Promise<void>;
  move(id: string, afterBlockId?: string): Promise<Block>;
}

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** Входная форма создания блока. */
export type CreateBlockFormInput = {
  pageId: string;
  content: Block['content'];
  afterBlockId?: string;
};
