import { describe, expect, it } from 'vitest';
import {
  canMoveBlock,
  createEmptyBlock,
  deserializeDocument,
  getBlockDefinition,
  listBlockDefinitions,
  registerBlock,
  serializeDocument,
} from './block';

describe('registerBlock / getBlockDefinition', () => {
  it('регистрирует тип и возвращает его определение', () => {
    registerBlock({
      type: 'paragraph',
      label: 'Текст',
      icon: '¶',
      create: () => ({ type: 'paragraph', content: '' }),
      toText: (content) => (content.type === 'paragraph' ? content.content : ''),
    });

    expect(getBlockDefinition('paragraph')?.label).toBe('Текст');
    expect(listBlockDefinitions().map((definition) => definition.type)).toContain('paragraph');
  });

  it('создаёт пустой блок зарегистрированного типа', () => {
    expect(createEmptyBlock('paragraph')).toEqual({ type: 'paragraph', content: '' });
  });

  it('падает на незарегистрированном типе', () => {
    expect(() => createEmptyBlock('heading')).toThrow(/не зарегистрирован/);
  });
});

describe('serializeDocument / deserializeDocument', () => {
  it('сериализует и десериализует массив блоков', () => {
    const blocks = [
      {
        id: 'b1',
        pageId: 'p1',
        type: 'paragraph',
        position: 'a0',
        content: { type: 'paragraph', content: 'Текст' },
        createdAt: '2026-10-18T00:00:00.000Z',
        updatedAt: '2026-10-18T00:00:00.000Z',
      },
    ];

    const json = serializeDocument(blocks as never);
    const restored = deserializeDocument(json);

    expect(restored).toHaveLength(1);
    expect(restored[0]?.content).toEqual({ type: 'paragraph', content: 'Текст' });
  });

  it('мигрирует старые строковые блоки в paragraph', () => {
    const restored = deserializeDocument(JSON.stringify(['старый текст']));

    expect(restored).toHaveLength(1);
    expect(restored[0]?.type).toBe('paragraph');
    expect(restored[0]?.content).toEqual({ type: 'paragraph', content: 'старый текст' });
  });

  it('отклоняет не-массив', () => {
    expect(() => deserializeDocument(JSON.stringify({ foo: 'bar' }))).toThrow(/массивом/);
  });
});

describe('canMoveBlock', () => {
  it('запрещает перемещение блока самого в себя', () => {
    expect(canMoveBlock([], 'b1', 'b1')).toBe(false);
  });

  it('разрешает перемещение к другому блоку', () => {
    expect(canMoveBlock([], 'b1', 'b2')).toBe(true);
  });

  it('разрешает перемещение в конец (null)', () => {
    expect(canMoveBlock([], 'b1', null)).toBe(true);
  });
});
