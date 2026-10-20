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
  title: 'Дорожная карта',
  icon: '🗺️',
  position: 'a0',
  isFavorite: false,
  isTrashed: false,
  createdBy: '2f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
};

describe('PageSchema', () => {
  it('принимает корректную страницу', () => {
    expect(PageSchema.parse(page)).toEqual(page);
  });

  it('требует parentId: null для корневой страницы, а не отсутствия поля', () => {
    const { parentId: _parentId, ...withoutParentId } = page;

    expect(() => PageSchema.parse(withoutParentId)).toThrow();
  });

  it('отклоняет пустой parentId и title длиннее 500 символов', () => {
    expect(() => PageSchema.parse({ ...page, parentId: '' })).toThrow();
    expect(() => PageSchema.parse({ ...page, title: 'x'.repeat(501) })).toThrow();
  });

  it('разрешает пустой title — новая страница ещё не названа', () => {
    expect(PageSchema.parse({ ...page, title: '' }).title).toBe('');
  });
});

describe('CreatePageInputSchema', () => {
  it('подставляет значения по умолчанию', () => {
    const parsed = CreatePageInputSchema.parse({
      workspaceId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    });

    expect(parsed).toMatchObject({ parentId: null, title: '' });
  });

  it('отклоняет неизвестный workspaceId', () => {
    expect(() => CreatePageInputSchema.parse({ workspaceId: 'workspace-1' })).toThrow();
  });
});

describe('UpdatePageInputSchema', () => {
  it('принимает частичное обновление', () => {
    expect(UpdatePageInputSchema.parse({ isFavorite: true })).toEqual({ isFavorite: true });
  });

  it('отклоняет пустой объект и поля без изменений', () => {
    expect(() => UpdatePageInputSchema.parse({})).toThrow();
    expect(() => UpdatePageInputSchema.parse({ title: 'x'.repeat(501) })).toThrow();
  });

  it('разрешает явный null для иконки и обложки', () => {
    expect(UpdatePageInputSchema.parse({ icon: null, coverFileId: null })).toEqual({
      icon: null,
      coverFileId: null,
    });
  });
});

describe('MovePageInputSchema', () => {
  it('требует parentId (в том числе null) и разрешает afterPageId', () => {
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
  it('различает блоки по типу', () => {
    expect(BlockContentSchema.parse({ type: 'paragraph', content: 'текст' })).toEqual({
      type: 'paragraph',
      content: 'текст',
    });
    expect(
      BlockContentSchema.parse({ type: 'heading', level: 2, content: 'Заголовок' }),
    ).toMatchObject({ level: 2 });
    expect(
      BlockContentSchema.parse({ type: 'heading', level: 4, content: 'Заголовок 4' }),
    ).toMatchObject({ level: 4 });
    expect(BlockContentSchema.parse({ type: 'divider' })).toEqual({ type: 'divider' });
  });

  it('проверяет поля конкретного типа', () => {
    expect(() => BlockContentSchema.parse({ type: 'heading', level: 5, content: 'x' })).toThrow();
    expect(() => BlockContentSchema.parse({ type: 'paragraph' })).toThrow();
    expect(() => BlockContentSchema.parse({ type: 'divider', content: 'лишнее' })).toThrow();
  });

  it('требует fileId для изображения и nullable caption', () => {
    expect(() => BlockContentSchema.parse({ type: 'image', caption: null })).toThrow();
    expect(
      BlockContentSchema.parse({
        type: 'image',
        fileId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        caption: null,
      }),
    ).toMatchObject({ caption: null });
  });

  it('покрыт всеми типами из BLOCK_TYPES', () => {
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
        caption: null,
      },
      toggle: { type: 'toggle', content: '' },
    };

    expect(Object.keys(samples).toSorted()).toEqual([...BLOCK_TYPES].toSorted());
  });
});

describe('BlockSchema', () => {
  it('требует pageId, позицию и согласованный content', () => {
    const block = {
      id: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      pageId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      type: 'paragraph',
      position: 'a0',
      content: { type: 'paragraph', content: 'текст' },
      createdAt: '2026-10-18T12:00:00.000Z',
      updatedAt: '2026-10-18T12:00:00.000Z',
    };

    expect(BlockSchema.parse(block)).toEqual(block);
  });
});

describe('CreateBlockInputSchema', () => {
  it('не принимает блок без валидного content', () => {
    expect(() => CreateBlockInputSchema.parse({ pageId: 'не-uuid' })).toThrow();
    expect(() =>
      CreateBlockInputSchema.parse({
        pageId: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        content: { type: 'unknown' },
      }),
    ).toThrow();
  });
});
