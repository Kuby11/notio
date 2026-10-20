import { describe, expect, it } from 'vitest';
import type { Block, BlockContent } from '@notio/contracts';
import {
  blocksToEditorDocument,
  editorDocumentToBlocks,
  findBlockIdAtSelection,
  type EditorDocument,
} from './block';

function block(id: string, content: BlockContent): Block {
  return {
    id,
    pageId: 'page-1',
    type: content.type,
    position: 'a0',
    content,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const BLOCKS: Block[] = [
  block('b1', { type: 'paragraph', content: 'Первый абзац' }),
  block('b2', { type: 'heading', level: 2, content: 'Заголовок' }),
  block('b3', { type: 'bulletedListItem', content: 'Пункт 1' }),
  block('b4', { type: 'bulletedListItem', content: 'Пункт 2' }),
  block('b5', { type: 'numberedListItem', content: 'Шаг 1' }),
  block('b6', { type: 'toDo', checked: true, content: 'Сделать' }),
  block('b7', { type: 'quote', content: 'Цитата' }),
  block('b8', { type: 'code', language: 'ts', content: 'const x = 1;' }),
  block('b9', { type: 'divider' }),
  block('b10', {
    type: 'image',
    fileId: '00000000-0000-4000-8000-000000000010',
    caption: 'Подпись',
  }),
  block('b11', { type: 'toggle', content: 'Скрытый текст' }),
];

describe('blocksToEditorDocument', () => {
  it('раскладывает все типы блоков в узлы Tiptap и сохраняет id', () => {
    const document = blocksToEditorDocument(BLOCKS);

    expect(document.content.map((node) => node.type)).toEqual([
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'toDo',
      'blockquote',
      'codeBlock',
      'horizontalRule',
      'image',
      'toggle',
    ]);
    expect(document.content[0]?.attrs).toEqual({ blockId: 'b1' });
    expect(document.content[2]?.content?.map((item) => item.attrs)).toEqual([
      { blockId: 'b3' },
      { blockId: 'b4' },
    ]);
    expect(document.content[4]).toMatchObject({ attrs: { blockId: 'b6', checked: true } });
    expect(document.content[7]).toMatchObject({ attrs: { blockId: 'b9' } });
  });

  it('преобразует переносы строк в hardBreak, кроме code', () => {
    const document = blocksToEditorDocument([
      block('b1', { type: 'paragraph', content: 'Первая\nВторая' }),
      block('b2', { type: 'code', language: null, content: 'Первая\nВторая' }),
    ]);

    expect(document.content[0]?.content?.map((node) => node.type)).toEqual([
      'text',
      'hardBreak',
      'text',
    ]);
    expect(document.content[1]?.content).toEqual([{ type: 'text', text: 'Первая\nВторая' }]);
  });

  it('поддерживает заголовок четвёртого уровня', () => {
    const heading = block('b1', { type: 'heading', level: 4, content: 'Заголовок 4' });
    const document = blocksToEditorDocument([heading]);

    expect(document.content[0]).toMatchObject({
      type: 'heading',
      attrs: { blockId: 'b1', level: 4 },
    });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: heading.content }]);
  });
});

describe('editorDocumentToBlocks', () => {
  it('возвращает исходные блоки в прежнем порядке', () => {
    const mapped = editorDocumentToBlocks(blocksToEditorDocument(BLOCKS));

    expect(mapped).toEqual(BLOCKS.map(({ id, content }) => ({ id, content })));
  });

  it('сохраняет пустые блоки и пустые элементы списка', () => {
    const blocks = [
      block('b1', { type: 'paragraph', content: '' }),
      block('b2', { type: 'bulletedListItem', content: '' }),
    ];

    expect(editorDocumentToBlocks(blocksToEditorDocument(blocks))).toEqual(
      blocks.map(({ id, content }) => ({ id, content })),
    );
  });

  it('разворачивает вложенные списки в отдельные блоки', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              attrs: { blockId: 'b1' },
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Родитель' }],
                },
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      attrs: { blockId: 'b2' },
                      content: [
                        {
                          type: 'paragraph',
                          content: [{ type: 'text', text: 'Ребёнок' }],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };

    expect(editorDocumentToBlocks(document)).toEqual([
      { id: 'b1', content: { type: 'bulletedListItem', content: 'Родитель' } },
      { id: 'b2', content: { type: 'bulletedListItem', content: 'Ребёнок' } },
    ]);
  });

  it('не создаёт image без fileId', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [{ type: 'image', attrs: { blockId: 'b1' } }],
    };

    expect(editorDocumentToBlocks(document)).toEqual([]);
  });
});

describe('findBlockIdAtSelection', () => {
  it('возвращает id атомарного узла под выделением', () => {
    const state = {
      doc: { nodeAt: () => ({ attrs: { blockId: 'image-1' } }) },
      selection: {
        from: 5,
        $from: {
          depth: 0,
          node: () => ({ attrs: {} }),
        },
      },
    };

    expect(findBlockIdAtSelection(state)).toBe('image-1');
  });

  it('не выбирает соседний атом на границе текстового блока', () => {
    const state = {
      doc: { nodeAt: () => ({ attrs: { blockId: 'image-1' } }) },
      selection: {
        from: 5,
        $from: {
          depth: 1,
          node: () => ({ attrs: { blockId: 'paragraph-1' } }),
        },
      },
    };

    expect(findBlockIdAtSelection(state)).toBe('paragraph-1');
  });

  it('поднимается к ближайшему предку с id', () => {
    const state = {
      doc: { nodeAt: () => null },
      selection: {
        from: 5,
        $from: {
          depth: 2,
          node: (depth: number) => ({ attrs: { blockId: depth === 1 ? 'block-1' : null } }),
        },
      },
    };

    expect(findBlockIdAtSelection(state)).toBe('block-1');
  });

  it('возвращает null, если id нет ни у узла, ни у предков', () => {
    const state = {
      doc: { nodeAt: () => null },
      selection: {
        from: 5,
        $from: {
          depth: 1,
          node: () => ({ attrs: {} }),
        },
      },
    };

    expect(findBlockIdAtSelection(state)).toBeNull();
  });
});
