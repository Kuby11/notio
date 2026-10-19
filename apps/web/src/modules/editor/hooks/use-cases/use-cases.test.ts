import { describe, expect, it } from 'vitest';
// AuthError не используется: ошибки приходят от репозитория как Error.
import { LoadDocument } from './load-document';
import { InsertBlock } from './insert-block';
import { UpdateBlock } from './update-block';
import { DeleteBlock } from './delete-block';
import { MoveBlock } from './move-block';
import type { BlockRepository } from '../../types/ports';
import type { Block } from '@notio/contracts';

/**
 * In-memory порт: use cases тестируются без React и без сети.
 */
class InMemoryBlockRepository implements BlockRepository {
  readonly calls: string[] = [];
  blocks: Block[] = [];
  listError: Error | null = null;
  createError: Error | null = null;
  updateError: Error | null = null;
  deleteError: Error | null = null;
  moveError: Error | null = null;

  async listByPage(pageId: string): Promise<Block[]> {
    this.calls.push('listByPage');

    if (this.listError !== null) {
      throw this.listError;
    }

    return this.blocks.filter((block) => block.pageId === pageId);
  }

  async create(pageId: string, content: Block['content'], afterBlockId?: string): Promise<Block> {
    this.calls.push('create');

    if (this.createError !== null) {
      throw this.createError;
    }

    const block: Block = {
      id: `block-${this.blocks.length + 1}`,
      pageId,
      type: content.type,
      position: 'a0',
      content,
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
    };

    this.blocks.push(block);

    void afterBlockId;

    return block;
  }

  async update(id: string, content: Block['content']): Promise<Block> {
    this.calls.push('update');

    if (this.updateError !== null) {
      throw this.updateError;
    }

    const block = this.blocks.find((item) => item.id === id);

    if (block === undefined) {
      throw new Error('Блок не найден');
    }

    block.content = content;
    block.updatedAt = '2026-10-18T00:00:01.000Z';

    return block;
  }

  async delete(id: string): Promise<void> {
    this.calls.push('delete');

    if (this.deleteError !== null) {
      throw this.deleteError;
    }

    this.blocks = this.blocks.filter((block) => block.id !== id);
  }

  async move(id: string, afterBlockId?: string): Promise<Block> {
    this.calls.push('move');

    if (this.moveError !== null) {
      throw this.moveError;
    }

    const block = this.blocks.find((item) => item.id === id);

    if (block === undefined) {
      throw new Error('Блок не найден');
    }

    void afterBlockId;

    return block;
  }
}

const BLOCK: Block = {
  id: 'block-1',
  pageId: 'page-1',
  type: 'paragraph',
  position: 'a0',
  content: { type: 'paragraph', content: 'Текст' },
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
};

describe('LoadDocument', () => {
  it('возвращает блоки страницы', async () => {
    const repository = new InMemoryBlockRepository();
    repository.blocks.push(BLOCK);

    const blocks = await new LoadDocument(repository).execute('page-1');

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.id).toBe('block-1');
  });

  it('возвращает пустой список для страницы без блоков', async () => {
    const repository = new InMemoryBlockRepository();

    expect(await new LoadDocument(repository).execute('page-1')).toEqual([]);
  });
});

describe('InsertBlock', () => {
  it('создаёт блок и возвращает его', async () => {
    const repository = new InMemoryBlockRepository();

    const block = await new InsertBlock(repository).execute('page-1', {
      type: 'paragraph',
      content: 'Новый блок',
    });

    expect(block.pageId).toBe('page-1');
    expect(block.content).toEqual({ type: 'paragraph', content: 'Новый блок' });
    expect(repository.calls).toContain('create');
  });

  it('пробрасывает ошибку сервиса', async () => {
    const repository = new InMemoryBlockRepository();
    repository.createError = new Error('Сервис недоступен');

    await expect(
      new InsertBlock(repository).execute('page-1', { type: 'paragraph', content: 'x' }),
    ).rejects.toThrow('Сервис недоступен');
  });
});

describe('UpdateBlock', () => {
  it('обновляет содержимое блока', async () => {
    const repository = new InMemoryBlockRepository();
    repository.blocks.push({ ...BLOCK });

    const updated = await new UpdateBlock(repository).execute('block-1', {
      type: 'paragraph',
      content: 'Обновлённый текст',
    });

    expect(updated.content).toEqual({ type: 'paragraph', content: 'Обновлённый текст' });
  });

  it('пробрасывает ошибку при отсутствии блока', async () => {
    const repository = new InMemoryBlockRepository();

    await expect(
      new UpdateBlock(repository).execute('missing', { type: 'paragraph', content: 'x' }),
    ).rejects.toThrow('Блок не найден');
  });
});

describe('DeleteBlock', () => {
  it('удаляет блок', async () => {
    const repository = new InMemoryBlockRepository();
    repository.blocks.push({ ...BLOCK });

    await new DeleteBlock(repository).execute('block-1');

    expect(repository.blocks).toHaveLength(0);
  });

  it('пробрасывает ошибку при отсутствии блока', async () => {
    const repository = new InMemoryBlockRepository();
    repository.deleteError = new Error('Блок не найден');

    await expect(new DeleteBlock(repository).execute('missing')).rejects.toThrow('Блок не найден');
  });
});

describe('MoveBlock', () => {
  it('перемещает блок', async () => {
    const repository = new InMemoryBlockRepository();
    repository.blocks.push({ ...BLOCK });

    const moved = (await new MoveBlock(repository).execute('block-1', 'block-2')) as { id: string };

    expect(moved.id).toBe('block-1');
    expect(repository.calls).toContain('move');
  });
});
