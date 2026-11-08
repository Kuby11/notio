import { describe, expect, it } from 'vitest';
import { BLOCK_TYPES, BlockContentSchema, BlockSchema, CreateBlockInputSchema } from './block';
import {
  CreatePageInputSchema,
  MovePageInputSchema,
  PageSchema,
  UpdatePageInputSchema,
} from './page';

const page = {
  id: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  workspaceId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  parentId: null,
  title: 'Roadmap',
  icon: '🗺️',
  position: 'a0',
  isFavorite: false,
  isTrashed: false,
  createdBy: '2f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
};

describe('PageSchema', () => {
  it('accepts a valid page', () => {
    expect(PageSchema.parse(page)).toEqual(page);
  });

  it('requires parentId: null for a root page, not a missing field', () => {
    const { parentId: _parentId, ...withoutParentId } = page;

    expect(() => PageSchema.parse(withoutParentId)).toThrow();
  });

  it('rejects an empty parentId and a title longer than 500 characters', () => {
    expect(() => PageSchema.parse({ ...page, parentId: '' })).toThrow();
    expect(() => PageSchema.parse({ ...page, title: 'x'.repeat(501) })).toThrow();
  });

  it('allows an empty title — a new page is not named yet', () => {
    expect(PageSchema.parse({ ...page, title: '' }).title).toBe('');
  });
});

describe('CreatePageInputSchema', () => {
  it('fills in default values', () => {
    const parsed = CreatePageInputSchema.parse({
      workspaceId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    });

    expect(parsed).toMatchObject({ parentId: null, title: '' });
  });

  it('rejects an unknown workspaceId', () => {
    expect(() => CreatePageInputSchema.parse({ workspaceId: 'workspace-1' })).toThrow();
  });
});

describe('UpdatePageInputSchema', () => {
  it('accepts a partial update', () => {
    expect(UpdatePageInputSchema.parse({ isFavorite: true })).toEqual({ isFavorite: true });
  });

  it('rejects an empty object', () => {
    expect(() => UpdatePageInputSchema.parse({})).toThrow();
    expect(() => UpdatePageInputSchema.parse({ title: 'x'.repeat(501) })).toThrow();
  });

  it('allows explicit null for the icon and cover', () => {
    expect(UpdatePageInputSchema.parse({ icon: null, coverFileId: null })).toEqual({
      icon: null,
      coverFileId: null,
    });
  });
});

describe('MovePageInputSchema', () => {
  it('requires parentId (including null) and allows afterPageId', () => {
    expect(MovePageInputSchema.parse({ parentId: null })).toEqual({ parentId: null });
    expect(
      MovePageInputSchema.parse({
        parentId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        afterPageId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      }),
    ).toHaveProperty('afterPageId');
  });
});

describe('BlockContentSchema', () => {
  it('distinguishes blocks by type', () => {
    expect(BlockContentSchema.parse({ type: 'paragraph', content: 'text' })).toEqual({
      type: 'paragraph',
      content: 'text',
    });
    expect(
      BlockContentSchema.parse({ type: 'heading', level: 2, content: 'Heading' }),
    ).toMatchObject({ level: 2 });
    expect(
      BlockContentSchema.parse({ type: 'heading', level: 4, content: 'Heading 4' }),
    ).toMatchObject({ level: 4 });
    expect(BlockContentSchema.parse({ type: 'divider' })).toEqual({ type: 'divider' });
  });

  it('validates type-specific fields', () => {
    expect(() => BlockContentSchema.parse({ type: 'heading', level: 5, content: 'x' })).toThrow();
    expect(() => BlockContentSchema.parse({ type: 'paragraph' })).toThrow();
    expect(() => BlockContentSchema.parse({ type: 'divider', content: 'extra' })).toThrow();
    expect(() =>
      BlockContentSchema.parse({
        type: 'video',
        fileId: null,
        url: 'javascript:alert(1)',
        caption: null,
      }),
    ).toThrow();
    expect(() =>
      BlockContentSchema.parse({
        type: 'file',
        fileId: null,
        url: null,
        name: '',
        sizeBytes: null,
      }),
    ).toThrow();
  });

  it('accepts text-block colour presets and rejects foreign values', () => {
    expect(
      BlockContentSchema.parse({
        type: 'paragraph',
        content: 'text',
        color: 'red',
        backgroundColor: 'blue',
      }),
    ).toEqual({ type: 'paragraph', content: 'text', color: 'red', backgroundColor: 'blue' });
    expect(() =>
      BlockContentSchema.parse({ type: 'paragraph', content: 'text', color: 'magenta' }),
    ).toThrow();
    expect(() =>
      BlockContentSchema.parse({ type: 'code', language: null, content: 'x', color: 'red' }),
    ).toThrow();
  });

  it('accepts table geometry and rejects foreign values', () => {
    expect(
      BlockContentSchema.parse({
        type: 'table',
        headerRow: true,
        rows: [['a', 'b']],
        colWidths: [100, null],
        rowHeights: [null, 44],
      }),
    ).toEqual({
      type: 'table',
      headerRow: true,
      rows: [['a', 'b']],
      colWidths: [100, null],
      rowHeights: [null, 44],
    });
    expect(() =>
      BlockContentSchema.parse({ type: 'table', headerRow: true, rows: [['a']], colWidths: [10] }),
    ).toThrow();
    expect(() =>
      BlockContentSchema.parse({ type: 'table', headerRow: true, rows: [['a']], rowHeights: [0] }),
    ).toThrow();
  });

  it('allows nested blocks and a collapsed toggle', () => {
    const toggle = {
      type: 'toggle',
      content: 'Toggle',
      open: false,
      children: [
        { type: 'paragraph', content: 'Inside' },
        {
          type: 'toggle',
          content: 'Nested',
          children: [{ type: 'toDo', checked: true, content: 'Task' }],
        },
      ],
    };

    expect(BlockContentSchema.parse(toggle)).toEqual(toggle);
  });

  it('requires a source on media blocks and a nullable caption', () => {
    expect(() => BlockContentSchema.parse({ type: 'image', caption: null })).toThrow();
    expect(() =>
      BlockContentSchema.parse({
        type: 'image',
        fileId: null,
        url: null,
        caption: null,
      }),
    ).toThrow();
    expect(
      BlockContentSchema.parse({
        type: 'image',
        fileId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        url: null,
        caption: null,
      }),
    ).toMatchObject({ caption: null });
    expect(
      BlockContentSchema.parse({
        type: 'video',
        fileId: null,
        url: 'https://example.com/clip.mp4',
        caption: null,
      }),
    ).toMatchObject({ url: 'https://example.com/clip.mp4' });
  });

  it('covers every type from BLOCK_TYPES', () => {
    const samples: Record<string, unknown> = {
      paragraph: { type: 'paragraph', content: '' },
      heading: { type: 'heading', level: 1, content: '' },
      bulletedListItem: { type: 'bulletedListItem', content: '' },
      numberedListItem: { type: 'numberedListItem', content: '' },
      toDo: { type: 'toDo', checked: false, content: '' },
      quote: { type: 'quote', content: '' },
      code: { type: 'code', language: null, content: '' },
      divider: { type: 'divider' },
      image: {
        type: 'image',
        fileId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        url: null,
        caption: null,
        wideWidth: 75,
        fullWidth: true,
      },
      video: { type: 'video', fileId: null, url: 'https://example.com/clip.mp4', caption: null },
      file: { type: 'file', fileId: null, url: null, name: 'doc.pdf', sizeBytes: 12 },
      emoji: { type: 'emoji', emoji: '🚀' },
      toggle: { type: 'toggle', content: '' },
      table: { type: 'table', headerRow: true, rows: [['', '']] },
      page: {
        type: 'page',
        pageId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        title: '',
        icon: null,
      },
      columns: {
        type: 'columns',
        columns: [{ children: [{ type: 'paragraph', content: '' }] }, {}],
      },
      equation: { type: 'equation', expression: 'E = mc^2' },
      linkToPage: {
        type: 'linkToPage',
        pageId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      },
      breadcrumb: { type: 'breadcrumb' },
      database: { type: 'database', databaseId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f' },
    };

    expect(Object.keys(samples).toSorted()).toEqual([...BLOCK_TYPES].toSorted());
  });
});

describe('BlockSchema', () => {
  it('requires a pageId, a position and matching content', () => {
    const block = {
      id: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      pageId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      type: 'paragraph',
      position: 'a0',
      content: { type: 'paragraph', content: 'text' },
      createdAt: '2026-10-18T12:00:00.000Z',
      updatedAt: '2026-10-18T12:00:00.000Z',
    };

    expect(BlockSchema.parse(block)).toEqual(block);
  });
});

describe('CreateBlockInputSchema', () => {
  it('rejects a block without valid content', () => {
    expect(() => CreateBlockInputSchema.parse({ pageId: 'not-a-uuid' })).toThrow();
    expect(() =>
      CreateBlockInputSchema.parse({
        pageId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        content: { type: 'unknown' },
      }),
    ).toThrow();
  });
});
