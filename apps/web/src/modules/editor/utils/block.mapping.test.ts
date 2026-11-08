import { describe, expect, it } from 'vitest';
import type { Block, BlockContent, InlineSegment, MathSegment, RichText } from '@notio/contracts';
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

/** Rich text into segments: a string → one segment without marks. */
function asSegments(text: RichText): (InlineSegment | MathSegment)[] {
  return typeof text === 'string' ? [{ text }] : text;
}

/** Canonical segment shape: no empty marks. A formula passes through as is. */
function canonicalSegment(segment: InlineSegment | MathSegment): InlineSegment | MathSegment {
  if ('math' in segment) {
    return segment;
  }

  return Array.isArray(segment.marks) && segment.marks.length > 0
    ? segment
    : { text: segment.text };
}

/** Deep BlockContent normalisation: strings → segments, recursively. */
function normalizeContent(content: BlockContent): BlockContent {
  // A code block stores flat text — marks do not live there.
  if (content.type === 'code') {
    return content;
  }

  if (content.type === 'toggle') {
    return {
      ...content,
      content: asSegments(content.content).map(canonicalSegment),
      children: content.children?.map((child) => normalizeContent(child)),
    };
  }

  if (content.type === 'columns') {
    return {
      ...content,
      columns: content.columns.map((column) => ({
        ...column,
        children: column.children?.map((child) => normalizeContent(child)),
      })),
    };
  }

  if (content.type === 'table') {
    return {
      ...content,
      rows: content.rows.map((row) => row.map((cell) => asSegments(cell).map(canonicalSegment))),
    };
  }

  if (!('content' in content)) {
    return content;
  }

  return {
    ...content,
    content: asSegments(content.content).map(canonicalSegment),
  };
}

function normalizeBlocks<T extends { id: string; content: BlockContent }>(
  blocks: readonly T[],
): T[] {
  return blocks.map((entry) => ({ ...entry, content: normalizeContent(entry.content) }));
}

const BLOCKS: Block[] = [
  block('b1', { type: 'paragraph', content: 'First paragraph' }),
  block('b2', { type: 'heading', level: 2, content: 'Heading' }),
  block('b3', { type: 'bulletedListItem', content: 'Item 1' }),
  block('b4', { type: 'bulletedListItem', content: 'Item 2' }),
  block('b5', { type: 'numberedListItem', content: 'Step 1' }),
  block('b6', { type: 'toDo', checked: true, content: 'Task' }),
  block('b7', { type: 'quote', content: 'Quote' }),
  block('b8', { type: 'code', language: 'ts', content: 'const x = 1;' }),
  block('b9', { type: 'divider' }),
  block('b10', {
    type: 'image',
    fileId: '00000000-0000-4000-8000-000000000010',
    url: null,
    caption: 'Caption',
  }),
  block('b11', { type: 'toggle', content: 'Toggle' }),
  block('b12', {
    type: 'table',
    headerRow: true,
    rows: [
      ['Name', 'Value'],
      ['One', '1'],
      ['Two', '2'],
    ],
  }),
  block('b13', {
    type: 'page',
    pageId: '00000000-0000-4000-8000-000000000013',
    title: 'Child page',
    icon: '📄',
  }),
  block('b14', {
    type: 'video',
    fileId: null,
    url: 'https://example.com/clip.mp4',
    caption: 'Clip',
  }),
  block('b15', {
    type: 'file',
    fileId: '00000000-0000-4000-8000-000000000015',
    url: null,
    name: 'doc.pdf',
    sizeBytes: 1234,
  }),
  block('b16', { type: 'emoji', emoji: '🚀' }),
];

describe('blocksToEditorDocument', () => {
  it('maps all block types into Tiptap nodes and keeps ids', () => {
    const document = blocksToEditorDocument(BLOCKS);

    expect(document.content.map((node) => node.type)).toEqual([
      'paragraph',
      'heading',
      'bulletList',
      'orderedList',
      'taskList',
      'blockquote',
      'codeBlock',
      'horizontalRule',
      'image',
      'details',
      'table',
      'subPage',
      'video',
      'file',
      'emoji',
    ]);
    expect(document.content[0]?.attrs).toEqual({ blockId: 'b1' });
    expect(document.content[2]?.content?.map((item) => item.attrs)).toEqual([
      { blockId: 'b3' },
      { blockId: 'b4' },
    ]);
    expect(document.content[4]?.content).toEqual([
      {
        type: 'taskItem',
        attrs: { blockId: 'b6', checked: true },
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Task' }] }],
      },
    ]);
    expect(document.content[7]).toMatchObject({ attrs: { blockId: 'b9' } });
    expect(document.content[9]).toMatchObject({
      type: 'details',
      attrs: { blockId: 'b11', open: true },
    });
  });

  it('converts line breaks into hardBreak, except in code', () => {
    const document = blocksToEditorDocument([
      block('b1', { type: 'paragraph', content: 'First\nSecond' }),
      block('b2', { type: 'code', language: null, content: 'First\nSecond' }),
    ]);

    expect(document.content[0]?.content?.map((node) => node.type)).toEqual([
      'text',
      'hardBreak',
      'text',
    ]);
    expect(document.content[1]?.content).toEqual([{ type: 'text', text: 'First\nSecond' }]);
  });

  it('nests child blocks into a toggle and keeps its collapsed state', () => {
    const toggle = block('b1', {
      type: 'toggle',
      content: 'Toggle heading',
      open: false,
      children: [
        { type: 'paragraph', content: 'Text inside' },
        { type: 'toDo', checked: true, content: 'Task inside' },
      ],
    });

    const document = blocksToEditorDocument([toggle]);

    expect(document.content[0]).toMatchObject({
      type: 'details',
      attrs: { blockId: 'b1', open: false },
    });
    expect(document.content[0]?.content?.map((node) => node.type)).toEqual([
      'detailsSummary',
      'detailsContent',
    ]);
    expect(document.content[0]?.content?.[1]?.content?.map((node) => node.type)).toEqual([
      'paragraph',
      'taskList',
    ]);
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([toggle]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('accepts an empty document without a content key (full block removal)', () => {
    // PM serialises a childless document as {type:'doc'}: there is no content key.
    expect(editorDocumentToBlocks({ type: 'doc' })).toEqual([]);
  });

  it('supports a fourth-level heading', () => {
    const heading = block('b1', { type: 'heading', level: 4, content: 'Heading 4' });
    const document = blocksToEditorDocument([heading]);

    expect(document.content[0]).toMatchObject({
      type: 'heading',
      attrs: { blockId: 'b1', level: 4 },
    });
    expect(editorDocumentToBlocks(document)).toEqual([
      { id: 'b1', content: { ...heading.content, content: asSegments('Heading 4') } },
    ]);
  });

  it('maps a table into rows and detects the header row', () => {
    const table = block('b1', {
      type: 'table',
      headerRow: true,
      rows: [
        ['Name', 'Value'],
        ['One', '1'],
      ],
    });
    const document = blocksToEditorDocument([table]);

    expect(document.content[0]).toMatchObject({ type: 'table', attrs: { blockId: 'b1' } });
    expect(document.content[0]?.content?.[0]?.content?.map((cell) => cell.type)).toEqual([
      'tableHeader',
      'tableHeader',
    ]);
    expect(document.content[0]?.content?.[1]?.content?.map((cell) => cell.type)).toEqual([
      'tableCell',
      'tableCell',
    ]);
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([table]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('keeps a table without a header row as headerRow: false', () => {
    const table = block('b1', {
      type: 'table',
      headerRow: false,
      rows: [['Just', 'cells']],
    });

    expect(editorDocumentToBlocks(blocksToEditorDocument([table]))).toEqual(
      normalizeBlocks([table]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('carries table column widths and row heights', () => {
    const table = block('b1', {
      type: 'table',
      headerRow: true,
      rows: [
        ['Name', 'Value'],
        ['One', '1'],
      ],
      colWidths: [180, null],
      rowHeights: [null, 44],
    });

    const document = blocksToEditorDocument([table]);
    const rows = document.content[0]?.content ?? [];

    // Missing values are not written into attrs: the default null applies.
    expect(rows[0]?.attrs).toEqual({});
    expect(rows[1]?.attrs).toEqual({ rowHeight: 44 });
    expect(rows[0]?.content?.[0]?.attrs).toEqual({ colwidth: [180] });
    expect(rows[0]?.content?.[1]?.attrs).toEqual({});
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([table]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('carries full-width images into attrs and back', () => {
    const image = block('b1', {
      type: 'image',
      fileId: '00000000-0000-4000-8000-000000000010',
      url: null,
      caption: null,
      width: 80,
      fullWidth: true,
    });

    const document = blocksToEditorDocument([image]);
    const attrs = document.content[0]?.attrs ?? {};

    expect(attrs).toMatchObject({ width: 80, fullWidth: true });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: image.content }]);
  });

  it('carries image width into attrs and back', () => {
    const image = block('b1', {
      type: 'image',
      fileId: '00000000-0000-4000-8000-000000000010',
      url: null,
      caption: null,
      width: 60,
    });

    const document = blocksToEditorDocument([image]);

    expect(document.content[0]?.attrs).toMatchObject({ width: 60 });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: image.content }]);
  });

  it('carries a wide image (wideWidth) into attrs and back', () => {
    const image = block('b1', {
      type: 'image',
      fileId: '00000000-0000-4000-8000-000000000010',
      url: null,
      caption: null,
      wideWidth: 75,
    });

    const document = blocksToEditorDocument([image]);
    const attrs = document.content[0]?.attrs ?? {};

    expect(attrs).toMatchObject({ wideWidth: 75 });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: image.content }]);
  });

  it('carries an inline equation into inlineMath and back', () => {
    const rich = block('b1', {
      type: 'paragraph',
      content: [{ text: 'Speed of light ' }, { math: 'c = 299\\,792\\,458' }, { text: ' m/s' }],
    });

    const document = blocksToEditorDocument([rich]);
    const mathNode = document.content[0]?.content?.[1];

    expect(mathNode).toMatchObject({
      type: 'inlineMath',
      attrs: { expression: 'c = 299\\,792\\,458' },
    });
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([rich]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('builds columns from children and trims empty trailing paragraphs', () => {
    const columns = block('b1', {
      type: 'columns',
      columns: [
        { children: [{ type: 'paragraph', content: [{ text: 'Left', marks: [] }] }] },
        { children: [{ type: 'paragraph', content: 'Right' }] },
      ],
    });

    const document = blocksToEditorDocument([columns]);
    const list = document.content[0];

    expect(list).toMatchObject({ type: 'columnsList', attrs: { blockId: 'b1' } });
    expect(list?.content?.[0]).toMatchObject({ type: 'columnsColumn' });
    expect(list?.content).toHaveLength(2);
    expect(list?.content?.[0]?.content?.[0]?.content?.[0]).toMatchObject({ text: 'Left' });
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([columns]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('does not serialize degenerate single-column layouts', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [
        {
          type: 'columnsList',
          attrs: { blockId: 'b1' },
          content: [{ type: 'columnsColumn', content: [{ type: 'paragraph' }] }],
        },
      ],
    };

    expect(editorDocumentToBlocks(document)).toEqual([]);
  });

  it('carries an equation block, a page link and breadcrumbs both ways', () => {
    const equation = block('b1', { type: 'equation', expression: 'e^{i\\pi} + 1 = 0' });
    const link = block('b2', {
      type: 'linkToPage',
      pageId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    });
    const breadcrumb = block('b3', { type: 'breadcrumb' });

    const document = blocksToEditorDocument([equation, link, breadcrumb]);

    expect(document.content[0]).toMatchObject({
      type: 'equationBlock',
      attrs: { blockId: 'b1', expression: 'e^{i\\pi} + 1 = 0' },
    });
    expect(document.content[1]).toMatchObject({
      type: 'pageLink',
      attrs: { blockId: 'b2', pageId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f' },
    });
    expect(document.content[2]).toMatchObject({
      type: 'breadcrumbBlock',
      attrs: { blockId: 'b3' },
    });
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([equation, link, breadcrumb]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('does not serialize a page link without a selected page', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [{ type: 'pageLink', attrs: { blockId: 'b1', pageId: '' } }],
    };

    expect(editorDocumentToBlocks(document)).toEqual([]);
  });

  it('carries inline marks through PM nodes both ways', () => {
    const rich = block('b1', {
      type: 'paragraph',
      content: [
        { text: 'Plain ' },
        { text: 'bold', marks: [{ type: 'bold' }] },
        { text: ' and ', marks: [] },
        { text: 'red', marks: [{ type: 'color', color: 'red' }] },
        { text: ' and ', marks: [] },
        { text: 'link', marks: [{ type: 'link', href: 'https://example.com' }] },
      ],
    });

    const document = blocksToEditorDocument([rich]);
    const textNode = document.content[0]?.content?.[1];

    expect(textNode).toMatchObject({ type: 'text', text: 'bold', marks: [{ type: 'bold' }] });
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([rich]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('carries text background and strike-through in a table', () => {
    const table = block('b1', {
      type: 'table',
      headerRow: true,
      rows: [
        [
          [
            { text: 'Cell ', marks: [] },
            {
              text: 'with background',
              marks: [{ type: 'backgroundColor', color: 'yellow' }, { type: 'strike' }],
            },
          ],
        ],
      ],
    });

    const document = blocksToEditorDocument([table]);
    const cellParagraph = document.content[0]?.content?.[0]?.content?.[0]?.content?.[0];

    expect(cellParagraph?.content?.[1]?.marks).toEqual([
      { type: 'textBg', attrs: { color: 'yellow' } },
      { type: 'strike' },
    ]);
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([table]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('carries a database block both ways', () => {
    const database = block('b1', {
      type: 'database',
      databaseId: '00000000-0000-4000-8000-000000000020',
    });

    const document = blocksToEditorDocument([database]);

    expect(document.content[0]).toEqual({
      type: 'databaseBlock',
      attrs: { blockId: 'b1', databaseId: '00000000-0000-4000-8000-000000000020' },
    });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: database.content }]);
  });

  it('keeps the selected view of a database block', () => {
    const database = block('b1', {
      type: 'database',
      databaseId: '00000000-0000-4000-8000-000000000020',
      viewId: '00000000-0000-4000-8000-000000000021',
    });

    const document = blocksToEditorDocument([database]);

    expect(document.content[0]).toEqual({
      type: 'databaseBlock',
      attrs: {
        blockId: 'b1',
        databaseId: '00000000-0000-4000-8000-000000000020',
        viewId: '00000000-0000-4000-8000-000000000021',
      },
    });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: database.content }]);
  });

  it('carries a page-style database link both ways', () => {
    const database = block('b1', {
      type: 'database',
      databaseId: '00000000-0000-4000-8000-000000000020',
      display: 'page',
    });

    const document = blocksToEditorDocument([database]);

    expect(document.content[0]).toEqual({
      type: 'databaseLink',
      attrs: { blockId: 'b1', databaseId: '00000000-0000-4000-8000-000000000020' },
    });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: database.content }]);
  });

  it('renders a sub-page link with page data', () => {
    const pageId = '00000000-0000-4000-8000-000000000013';
    const subPage = block('b1', {
      type: 'page',
      pageId,
      title: 'Child page',
      icon: '📄',
    });
    const document = blocksToEditorDocument([subPage]);

    expect(document.content[0]).toEqual({
      type: 'subPage',
      attrs: { blockId: 'b1', pageId, title: 'Child page', icon: '📄' },
    });
    expect(editorDocumentToBlocks(document)).toEqual([{ id: 'b1', content: subPage.content }]);
  });
});

describe('editorDocumentToBlocks', () => {
  it('returns the original blocks in their order, normalizing text', () => {
    const mapped = editorDocumentToBlocks(blocksToEditorDocument(BLOCKS));

    expect(mapped).toEqual(normalizeBlocks(BLOCKS.map(({ id, content }) => ({ id, content }))));
  });

  it('keeps empty blocks and empty list items', () => {
    const blocks = [
      block('b1', { type: 'paragraph', content: '' }),
      block('b2', { type: 'bulletedListItem', content: '' }),
    ];

    expect(editorDocumentToBlocks(blocksToEditorDocument(blocks))).toEqual(
      blocks.map(({ id, content }) => ({ id, content: { ...content, content: [] } })),
    );
  });

  it('unfolds nested lists into separate blocks', () => {
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
                  content: [{ type: 'text', text: 'Parent' }],
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
                          content: [{ type: 'text', text: 'Child' }],
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

    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([
        block('b1', { type: 'bulletedListItem', content: 'Parent' }),
        block('b2', { type: 'bulletedListItem', content: 'Child' }),
      ]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('does not create an image without fileId', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [{ type: 'image', attrs: { blockId: 'b1' } }],
    };

    expect(editorDocumentToBlocks(document)).toEqual([]);
  });

  it('does not save a database block without an id — the database is still being created', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [{ type: 'databaseBlock', attrs: { blockId: 'b1', databaseId: '' } }],
    };

    expect(editorDocumentToBlocks(document)).toEqual([]);
  });

  it('does not create a sub-page without pageId — the page is still being created by the service', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [{ type: 'subPage', attrs: { blockId: 'b1', pageId: null } }],
    };

    expect(editorDocumentToBlocks(document)).toEqual([]);
  });

  it('does not save a table without rows', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [{ type: 'table', attrs: { blockId: 'b1' }, content: [] }],
    };

    expect(editorDocumentToBlocks(document)).toEqual([]);
  });

  it('carries text and background colors through node attrs', () => {
    const blocks = [
      block('b1', { type: 'paragraph', content: 'Text', color: 'red', backgroundColor: 'blue' }),
      block('b2', { type: 'bulletedListItem', content: 'Item', color: 'green' }),
      block('b3', { type: 'toggle', content: 'Toggle', backgroundColor: 'yellow' }),
    ];

    const document = blocksToEditorDocument(blocks);

    expect(document.content[0]?.attrs).toMatchObject({ color: 'red', backgroundColor: 'blue' });
    expect(document.content[1]?.content?.[0]?.attrs).toMatchObject({ color: 'green' });
    expect(document.content[2]?.attrs).toMatchObject({ backgroundColor: 'yellow' });
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks(blocks).map(({ id, content }) => ({ id, content })),
    );
  });

  it('carries table colors into node attrs and back', () => {
    const table = block('b1', {
      type: 'table',
      headerRow: true,
      rows: [['a', 'b']],
      color: 'green',
      backgroundColor: 'yellow',
    });

    const document = blocksToEditorDocument([table]);

    expect(document.content[0]?.attrs).toMatchObject({ color: 'green', backgroundColor: 'yellow' });
    expect(editorDocumentToBlocks(document)).toEqual(
      normalizeBlocks([table]).map(({ id, content }) => ({ id, content })),
    );
  });

  it('ignores an unknown color value from attrs', () => {
    const document: EditorDocument = {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { blockId: 'b1', color: 'not-a-preset' } }],
    };

    expect(editorDocumentToBlocks(document)).toEqual([
      { id: 'b1', content: { type: 'paragraph', content: [] } },
    ]);
  });
});

describe('findBlockIdAtSelection', () => {
  it('returns the id of the atomic node under the selection', () => {
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

  it('does not pick a neighboring atom at a text block boundary', () => {
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

  it('walks up to the nearest ancestor with an id', () => {
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

  it('returns null when neither the node nor its ancestors have an id', () => {
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
