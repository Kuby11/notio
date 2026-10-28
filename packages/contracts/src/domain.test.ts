import { describe, expect, it } from 'vitest';
import { PAGE_EVENT_TYPES, PageEventSchema } from './events';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  FileMetaSchema,
  isAllowedMimeType,
  MAX_UPLOAD_SIZE_BYTES,
} from './file';
import {
  BooleanQuerySchema,
  PageFavoritesQuerySchema,
  PageListQuerySchema,
  PageTrashQuerySchema,
} from './queries';
import { PageSchema } from './page';
import { UserSchema } from './user';
import { ROLE_PERMISSIONS, roleCan, WORKSPACE_ROLES, WorkspaceSchema } from './workspace';

const page = {
  id: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  workspaceId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  parentId: null,
  title: 'Страница',
  position: 'a0',
  isFavorite: false,
  isTrashed: false,
  createdBy: '2f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  createdAt: '2026-10-18T12:00:00.000Z',
  updatedAt: '2026-10-18T12:00:00.000Z',
};

const eventBase = {
  id: '3f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  occurredAt: '2026-10-18T12:00:00.000Z',
  workspaceId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
  pageId: page.id,
  actorId: null,
};

describe('PageSchema', () => {
  it('принимает вычисляемый hasChildren только в списках дерева', () => {
    expect(PageSchema.parse({ ...page, hasChildren: true })).toMatchObject({
      hasChildren: true,
    });
    expect(PageSchema.parse(page).hasChildren).toBeUndefined();
  });
});

describe('UserSchema', () => {
  it('требует корректный email и непустое имя', () => {
    const user = {
      id: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
      email: 'user@notio.dev',
      name: 'Аня',
      createdAt: '2026-10-18T12:00:00.000Z',
    };

    expect(UserSchema.parse(user)).toEqual(user);
    expect(() => UserSchema.parse({ ...user, email: 'не-почта' })).toThrow();
    expect(() => UserSchema.parse({ ...user, name: '' })).toThrow();
  });

  it('опционально принимает imageUrl только как URL', () => {
    expect(() =>
      UserSchema.parse({
        id: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
        email: 'user@notio.dev',
        name: 'Аня',
        imageUrl: 'javascript:alert(1)',
        createdAt: '2026-10-18T12:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('WorkspaceSchema и роли', () => {
  const workspace = {
    id: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    name: 'Команда notio',
    slug: 'notio-team',
    ownerId: '2f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    archivedAt: null,
    createdAt: '2026-10-18T12:00:00.000Z',
    updatedAt: '2026-10-18T12:00:00.000Z',
  };

  it('принимает рабочее пространство со слагом', () => {
    expect(WorkspaceSchema.parse(workspace)).toEqual(workspace);
  });

  it('описывает роли owner/editor/viewer и матрицу прав', () => {
    expect(WORKSPACE_ROLES).toEqual(['owner', 'editor', 'viewer']);
    expect(roleCan('owner', 'member:manage')).toBe(true);
    expect(roleCan('editor', 'member:manage')).toBe(false);
    expect(roleCan('editor', 'page:write')).toBe(true);
    expect(roleCan('viewer', 'page:read')).toBe(true);
    expect(roleCan('viewer', 'page:write')).toBe(false);
  });

  it('каждой роли соответствует непустой набор прав из общего списка', () => {
    const permissions = new Set(Object.values(ROLE_PERMISSIONS).flat());

    for (const role of WORKSPACE_ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(permissions.has(permission)).toBe(true);
      }
    }
  });
});

describe('FileMetaSchema', () => {
  const file = {
    id: '9f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    workspaceId: '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f',
    key: 'notio/1f1c0e2a/file.png',
    fileName: 'file.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    createdAt: '2026-10-18T12:00:00.000Z',
  };

  it('хранит ключ объекта R2, а не публичный URL', () => {
    expect(FileMetaSchema.parse(file)).toEqual(file);
    expect(() =>
      FileMetaSchema.parse({ ...file, key: 'https://cdn.notio.dev/file.png' }),
    ).not.toThrow();
  });

  it('отклоняет отрицательный размер', () => {
    expect(() => FileMetaSchema.parse({ ...file, sizeBytes: -1 })).toThrow();
  });

  it('пускает только типы из allowlist и ограничивает размер', () => {
    expect(isAllowedMimeType('image/png')).toBe(true);
    expect(isAllowedMimeType('application/x-msdownload')).toBe(false);
    expect(ALLOWED_UPLOAD_MIME_TYPES).toContain('application/pdf');
    expect(MAX_UPLOAD_SIZE_BYTES).toBeGreaterThan(0);
  });
});

describe('PageListQuerySchema', () => {
  const workspaceId = '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f';

  it('по умолчанию показывает корень без корзины', () => {
    expect(PageListQuerySchema.parse({ workspaceId })).toMatchObject({
      parentId: null,
      includeTrashed: false,
      limit: 50,
    });
  });

  it('разбирает строковые query-параметры', () => {
    const parsed = PageListQuerySchema.parse({
      workspaceId,
      includeTrashed: 'true',
      limit: '10',
      cursor: 'a0V',
    });

    expect(parsed).toMatchObject({ includeTrashed: true, limit: 10, cursor: 'a0V' });
  });

  it('не путает "false" с true', () => {
    expect(PageListQuerySchema.parse({ workspaceId, includeTrashed: 'false' }).includeTrashed).toBe(
      false,
    );
  });

  it('ограничивает limit диапазоном 1..100', () => {
    expect(() => PageListQuerySchema.parse({ workspaceId, limit: '0' })).toThrow();
    expect(() => PageListQuerySchema.parse({ workspaceId, limit: '101' })).toThrow();
    expect(() => PageListQuerySchema.parse({ workspaceId, limit: 'много' })).toThrow();
  });

  it('требует корректный workspaceId', () => {
    expect(() => PageListQuerySchema.parse({ workspaceId: 'ws' })).toThrow();
  });

  it('BooleanQuerySchema отвергает мусор', () => {
    expect(() => BooleanQuerySchema.parse('yes')).toThrow();
  });
});

describe('PageFavoritesQuerySchema', () => {
  const workspaceId = '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f';

  it('принимает запрос избранного по workspace', () => {
    expect(PageFavoritesQuerySchema.parse({ workspaceId })).toEqual({ workspaceId });
  });

  it('требует корректный workspaceId', () => {
    expect(() => PageFavoritesQuerySchema.parse({ workspaceId: 'ws' })).toThrow();
  });
});

describe('PageTrashQuerySchema', () => {
  const workspaceId = '1f1c0e2a-3b4d-4c5e-8f90-1a2b3c4d5e6f';

  it('принимает запрос корзины по workspace', () => {
    expect(PageTrashQuerySchema.parse({ workspaceId })).toEqual({ workspaceId });
  });

  it('требует корректный workspaceId', () => {
    expect(() => PageTrashQuerySchema.parse({ workspaceId: 'ws' })).toThrow();
  });
});

describe('PageEventSchema', () => {
  it('принимает page.created с полной сущностью страницы', () => {
    const event = { ...eventBase, type: 'page.created', payload: { page } };

    expect(PageEventSchema.parse(event)).toEqual(event);
  });

  it('принимает остальные типы событий', () => {
    expect(
      PageEventSchema.parse({
        ...eventBase,
        type: 'page.updated',
        payload: { page, changedFields: ['title'] },
      }),
    ).toMatchObject({ type: 'page.updated' });

    expect(
      PageEventSchema.parse({ ...eventBase, type: 'page.deleted', payload: { trashed: true } }),
    ).toMatchObject({ type: 'page.deleted' });

    expect(
      PageEventSchema.parse({
        ...eventBase,
        type: 'page.moved',
        payload: { parentId: page.id, position: 'a1' },
      }),
    ).toMatchObject({ type: 'page.moved' });
  });

  it('отклоняет payload, не соответствующий типу', () => {
    expect(() =>
      PageEventSchema.parse({ ...eventBase, type: 'page.updated', payload: { page } }),
    ).toThrow();
  });

  it('PAGE_EVENT_TYPES совпадает с типами схемы', () => {
    expect([...PAGE_EVENT_TYPES]).toEqual([
      'page.created',
      'page.updated',
      'page.deleted',
      'page.moved',
    ]);
  });
});
