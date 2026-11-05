import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, type Block } from '@notio/contracts';
import {
  blockIdFromAttrs,
  richToPlain,
  blockToText,
  canMoveBlock,
  contentToText,
  createEmptyBlock,
  deserializeDocument,
  getBlockDefinition,
  listBlockDefinitions,
  registerBlock,
  serializeDocument,
  toEditorText,
} from './block';

describe('registerBlock / getBlockDefinition', () => {
  it('регистрирует тип и возвращает его определение', () => {
    registerBlock({
      type: 'paragraph',
      label: 'Текст',
      icon: '¶',
      create: () => ({ type: 'paragraph', content: '' }),
      toText: (content) => (content.type === 'paragraph' ? richToPlain(content.content) : ''),
    });

    expect(getBlockDefinition('paragraph')?.label).toBe('Текст');
    expect(listBlockDefinitions().map((definition) => definition.type)).toContain('paragraph');
  });

  it('регистрирует все типы из контракта', () => {
    expect(
      listBlockDefinitions()
        .map((definition) => definition.type)
        .toSorted(),
    ).toEqual([...BLOCK_TYPES].toSorted());
  });

  it('создаёт пустой блок зарегистрированного типа', () => {
    expect(createEmptyBlock('heading')).toEqual({ type: 'heading', level: 1, content: '' });
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

function block(id: string, type: Block['type'], content: Block['content']): Block {
  return {
    id,
    pageId: 'page-1',
    type,
    position: 'a0',
    content,
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
  };
}

describe('blockToText / contentToText', () => {
  it('текст незарегистрированного типа берётся из content', () => {
    const quote = block('b1', 'quote', { type: 'quote', content: 'Цитата' });

    expect(blockToText(quote)).toBe('Цитата');
  });

  it('у блока без текстового содержимого текста нет', () => {
    const divider = block('b2', 'divider', { type: 'divider' });

    expect(contentToText(divider.content)).toBe('');
    expect(blockToText(divider)).toBe('');
  });
});

describe('default definitions coverage', () => {
  it('creates every contract type and produces preview text', () => {
    for (const type of BLOCK_TYPES) {
      const content = createEmptyBlock(type);
      const value = blockToText(block(`id-${type}`, type, content));

      expect({ type, value: typeof value }).toEqual({ type, value: 'string' });
    }
  });

  it('returns an empty preview when a definition gets another content type', () => {
    for (const type of BLOCK_TYPES) {
      const value = blockToText(
        block(`id-${type}`, type, { type: 'paragraph', content: '' } as never),
      );

      expect({ type, value }).toEqual({ type, value: '' });
    }
  });

  it('renders table, columns and toggle preview text', () => {
    expect(
      blockToText(
        block('b1', 'table', {
          type: 'table',
          headerRow: true,
          rows: [
            ['a', 'b'],
            ['c', 'd'],
          ],
        }),
      ),
    ).toBe('a\tb\nc\td');

    expect(
      blockToText(
        block('b2', 'columns', {
          type: 'columns',
          columns: [{ children: [{ type: 'paragraph', content: 'Left' }] }, { children: [] }, {}],
        }),
      ),
    ).toBe('Left\n\n');

    expect(
      contentToText({
        type: 'toggle',
        content: 'Head',
        children: [
          { type: 'paragraph', content: '' },
          { type: 'paragraph', content: 'Body' },
          { type: 'toggle', content: 'Nested' },
        ],
      }),
    ).toBe('Head\nBody\nNested');
  });

  it('rejects an unregistered type', () => {
    expect(() => createEmptyBlock('unknown' as never)).toThrow(/не зарегистрирован/);
    expect(getBlockDefinition('unknown' as never)).toBeUndefined();
  });

  it('reads block ids only from non-empty strings', () => {
    expect(blockIdFromAttrs({ blockId: 'b1' })).toBe('b1');
    expect(blockIdFromAttrs({ blockId: '' })).toBeUndefined();
    expect(blockIdFromAttrs({ blockId: 42 })).toBeUndefined();
    expect(blockIdFromAttrs(undefined)).toBeUndefined();
  });

  it('flattens rich text with formulas', () => {
    expect(richToPlain('plain')).toBe('plain');
    expect(richToPlain([{ text: 'a' }, { math: 'x^2' }, { text: 'b' }])).toBe('ax^2b');
  });
});

describe('toEditorText', () => {
  it('собирает плоский текст документа и пропускает пустые строки', () => {
    const blocks = [
      block('b1', 'paragraph', { type: 'paragraph', content: 'Первая' }),
      block('b2', 'paragraph', { type: 'paragraph', content: '' }),
      block('b3', 'paragraph', { type: 'paragraph', content: 'Третья' }),
    ];

    expect(toEditorText(blocks)).toBe('Первая\nТретья');
  });
});
