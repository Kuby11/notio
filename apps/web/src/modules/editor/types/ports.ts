import type { Block } from '@notio/contracts';

/**
 * Порт репозитория блоков.
 *
 * Реализация — адаптер поверх gateway; facade-хуки знают только этот
 * интерфейс, поэтому в тестах подставляется in-memory версия без сети.
 */
export interface BlockRepository {
  listByPage(pageId: string): Promise<Block[]>;
  create(pageId: string, content: Block['content'], afterBlockId?: string): Promise<Block>;
  update(id: string, content: Block['content']): Promise<Block>;
  delete(id: string): Promise<void>;
  move(id: string, afterBlockId?: string): Promise<Block>;
}

/** Входная форма создания блока: минимум полей для UI. */
export type CreateBlockFormInput = {
  pageId: string;
  content: Block['content'];
  afterBlockId?: string;
};
