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
  it('registers a type and returns its definition', () => {
    registerBlock({
      type: 'paragraph',
      label: 'Text',
      icon: '¶',
      create: () => ({ type: 'paragraph', content: '' }),
      toText: (content) => (content.type === 'paragraph' ? richToPlain(content.content) : ''),
    });

    expect(getBlockDefinition('paragraph')?.label).toBe('Text');
    expect(listBlockDefinitions().map((definition) => definition.type)).toContain('paragraph');
  });

  it('registers all types from the contract', () => {
    expect(
      listBlockDefinitions()
        .map((definition) => definition.type)
        .toSorted(),
    ).toEqual([...BLOCK_TYPES].toSorted());
  });

  it('creates an empty block of a registered type', () => {
    expect(createEmptyBlock('heading')).toEqual({ type: 'heading', level: 1, content: '' });
  });
});

describe('serializeDocument / deserializeDocument', () => {
  it('serializes and deserializes an array of blocks', () => {
    const blocks = [
      {
        id: 'b1',
        pageId: 'p1',
        type: 'paragraph',
        position: 'a0',
        content: { type: 'paragraph', content: 'Text' },
        createdAt: '2026-10-18T00:00:00.000Z',
        updatedAt: '2026-10-18T00:00:00.000Z',
      },
    ];

    const json = serializeDocument(blocks as never);
    const restored = deserializeDocument(json);

    expect(restored).toHaveLength(1);
    expect(restored[0]?.content).toEqual({ type: 'paragraph', content: 'Text' });
  });

  it('migrates legacy string blocks into paragraphs', () => {
    const restored = deserializeDocument(JSON.stringify(['legacy text']));

    expect(restored).toHaveLength(1);
    expect(restored[0]?.type).toBe('paragraph');
    expect(restored[0]?.content).toEqual({ type: 'paragraph', content: 'legacy text' });
  });

  it('rejects a non-array', () => {
    expect(() => deserializeDocument(JSON.stringify({ foo: 'bar' }))).toThrow(/array of blocks/);
  });
});

describe('canMoveBlock', () => {
  it('forbids moving a block into itself', () => {
    expect(canMoveBlock([], 'b1', 'b1')).toBe(false);
  });

  it('allows moving next to another block', () => {
    expect(canMoveBlock([], 'b1', 'b2')).toBe(true);
  });

  it('allows moving to the end (null)', () => {
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
  it('takes text of an unregistered type from content', () => {
    const quote = block('b1', 'quote', { type: 'quote', content: 'Quote' });

    expect(blockToText(quote)).toBe('Quote');
  });

  it('gives no text to a block without text content', () => {
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
    expect(() => createEmptyBlock('unknown' as never)).toThrow(/is not registered/);
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
  it('flattens document text and skips empty lines', () => {
    const blocks = [
      block('b1', 'paragraph', { type: 'paragraph', content: 'First' }),
      block('b2', 'paragraph', { type: 'paragraph', content: '' }),
      block('b3', 'paragraph', { type: 'paragraph', content: 'Third' }),
    ];

    expect(toEditorText(blocks)).toBe('First\nThird');
  });
});
