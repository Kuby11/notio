import { describe, expect, it } from 'vitest';
import { CreatePage } from './create-page';
import { ListChildren } from './list-children';
import { MovePage } from './move-page';
import { RenamePage } from './rename-page';
import { TrashPage } from './trash-page';
import { RestorePage } from './restore-page';
import { ToggleFavorite } from './toggle-favorite';
import type { PageRepository } from '../../types/ports';
import type { Page } from '@notio/contracts';

/**
 * In-memory порт: use cases тестируются без React и без сети.
 */
class InMemoryPageRepository implements PageRepository {
  pages: Page[] = [];

  async listChildren(
    workspaceId: string,
    parentId: string | null,
    includeTrashed: boolean,
  ): Promise<Page[]> {
    return this.pages.filter(
      (page) =>
        page.workspaceId === workspaceId &&
        page.parentId === parentId &&
        (includeTrashed || !page.isTrashed),
    );
  }

  async create(input: {
    workspaceId: string;
    parentId: string | null;
    title: string;
    icon?: string;
  }): Promise<Page> {
    const page: Page = {
      id: `page-${this.pages.length + 1}`,
      workspaceId: input.workspaceId,
      parentId: input.parentId,
      title: input.title,
      icon: input.icon,
      position: 'a0',
      isFavorite: false,
      isTrashed: false,
      createdBy: 'user-1',
      createdAt: '2026-10-18T00:00:00.000Z',
      updatedAt: '2026-10-18T00:00:00.000Z',
    };

    this.pages.push(page);

    return page;
  }

  async getPage(id: string, workspaceId: string): Promise<Page> {
    const page = this.pages.find((p) => p.id === id && p.workspaceId === workspaceId);

    if (!page) {
      throw new Error('Страница не найдена');
    }

    return page;
  }

  async update(
    id: string,
    workspaceId: string,
    patch: { title?: string; isFavorite?: boolean; isTrashed?: boolean },
  ): Promise<Page> {
    const page = this.pages.find((p) => p.id === id && p.workspaceId === workspaceId);

    if (!page) {
      throw new Error('Страница не найдена');
    }

    if (patch.title !== undefined) {
      page.title = patch.title;
    }
    if (patch.isFavorite !== undefined) {
      page.isFavorite = patch.isFavorite;
    }
    if (patch.isTrashed !== undefined) {
      page.isTrashed = patch.isTrashed;
    }

    return page;
  }

  async move(
    id: string,
    workspaceId: string,
    input: { parentId: string | null; afterPageId?: string },
  ): Promise<Page> {
    const page = this.pages.find((p) => p.id === id && p.workspaceId === workspaceId);

    if (!page) {
      throw new Error('Страница не найдена');
    }

    page.parentId = input.parentId;

    return page;
  }
}

const PAGE: Page = {
  id: 'page-1',
  workspaceId: 'ws-1',
  parentId: null,
  title: 'Тестовая страница',
  position: 'a0',
  isFavorite: false,
  isTrashed: false,
  createdBy: 'user-1',
  createdAt: '2026-10-18T00:00:00.000Z',
  updatedAt: '2026-10-18T00:00:00.000Z',
};

describe('CreatePage', () => {
  it('создаёт страницу в корне', async () => {
    const repository = new InMemoryPageRepository();

    const page = await new CreatePage(repository).execute({ workspaceId: 'ws-1', title: 'Новая' });

    expect(page.title).toBe('Новая');
    expect(page.parentId).toBeNull();
  });

  it('создаёт страницу с родителем', async () => {
    const repository = new InMemoryPageRepository();

    const page = await new CreatePage(repository).execute({
      workspaceId: 'ws-1',
      parentId: 'parent-1',
      title: 'Дочерняя',
    });

    expect(page.parentId).toBe('parent-1');
  });

  it('использует пустое имя по умолчанию', async () => {
    const repository = new InMemoryPageRepository();

    const page = await new CreatePage(repository).execute({ workspaceId: 'ws-1' });

    expect(page.title).toBe('');
  });
});

describe('ListChildren', () => {
  it('возвращает детей без удалённых по умолчанию', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE, isTrashed: true });

    const children = await new ListChildren(repository).execute('ws-1', null);

    expect(children).toHaveLength(0);
  });

  it('возвращает детей с удалёнными при запросе', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE, isTrashed: true });

    const children = await new ListChildren(repository).execute('ws-1', null, true);

    expect(children).toHaveLength(1);
  });
});

describe('MovePage', () => {
  it('перемещает страницу к новому родителю', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE });

    const page = await new MovePage(repository).execute({
      pageId: 'page-1',
      workspaceId: 'ws-1',
      newParentId: 'parent-2',
      tree: [],
    });

    expect(page.parentId).toBe('parent-2');
  });

  it('запрещает перемещение внутрь собственного потомка', async () => {
    const repository = new InMemoryPageRepository();
    const child: Page = { ...PAGE, id: 'child-1', parentId: 'page-1' };
    repository.pages.push({ ...PAGE }, child);

    const tree = [{ ...PAGE, children: [{ ...child, children: [] }] }];

    await expect(
      new MovePage(repository).execute({
        pageId: 'page-1',
        workspaceId: 'ws-1',
        newParentId: 'child-1',
        tree,
      }),
    ).rejects.toThrow(/потомка/);
  });
});

describe('RenamePage', () => {
  it('обрезает пробелы и переименовывает', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE });

    const page = await new RenamePage(repository).execute('page-1', 'ws-1', '  Новое имя  ');

    expect(page.title).toBe('Новое имя');
  });

  it('подставляет имя по умолчанию для пустой строки', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE });

    const page = await new RenamePage(repository).execute('page-1', 'ws-1', '   ');

    expect(page.title).toBe('Без названия');
  });
});

describe('TrashPage', () => {
  it('помечает страницу удалённой', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE });

    const page = await new TrashPage(repository).execute('page-1', 'ws-1');

    expect(page.isTrashed).toBe(true);
  });
});

describe('RestorePage', () => {
  it('возвращает страницу из корзины', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE, isTrashed: true });

    const page = await new RestorePage(repository).execute('page-1', 'ws-1');

    expect(page.isTrashed).toBe(false);
  });
});

describe('ToggleFavorite', () => {
  it('переключает избранное', async () => {
    const repository = new InMemoryPageRepository();
    repository.pages.push({ ...PAGE });

    const page = await new ToggleFavorite(repository).execute('page-1', 'ws-1', true);

    expect(page.isFavorite).toBe(true);
  });
});
