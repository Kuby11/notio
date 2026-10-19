import type {
  CreatePageInput,
  MovePageInput,
  Page,
  PageFavoritesQuery,
  PageListQuery,
  PageTrashQuery,
  UpdatePageInput,
} from '@notio/contracts';
import { IdSchema, newId } from '@notio/contracts';
import { generateKeyBetween } from 'fractional-indexing';
import type { Bindings } from '../env';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import { PageRepository } from '../repositories/page.repository';

/** Источник времени внедряется, чтобы тесты не зависели от системных часов. */
export type Clock = () => Date;

export interface PageListResult {
  items: Page[];
  nextCursor: string | null;
}

/**
 * Сценарии работы со страницами.
 *
 * Слой не знает про HTTP: ни Request, ни Response, ни кодов статусов —
 * только доменные типы и типизированные ошибки.
 */
export class PageService {
  constructor(
    private readonly pages: PageRepository,
    private readonly clock: Clock,
  ) {}

  private now(): string {
    return this.clock().toISOString();
  }

  async createPage(input: CreatePageInput, actorId: string): Promise<Page> {
    await this.assertParentIsUsable(input.workspaceId, input.parentId);

    const bounds = await this.pages.findPositionBounds(
      input.workspaceId,
      input.parentId,
      input.afterPageId,
    );
    const now = this.now();

    return this.pages.create({
      id: newId(),
      workspaceId: input.workspaceId,
      parentId: input.parentId,
      title: input.title,
      icon: input.icon ?? null,
      coverFileId: null,
      position: generateKeyBetween(bounds.before, bounds.after),
      isFavorite: false,
      isTrashed: false,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });
  }

  async listChildren(query: PageListQuery): Promise<PageListResult> {
    // Запрашиваем на одну строку больше: лишняя строка становится курсором.
    const items = await this.pages.listChildren({
      workspaceId: query.workspaceId,
      parentId: query.parentId,
      includeTrashed: query.includeTrashed,
      afterPosition: query.cursor,
      limit: query.limit + 1,
    });

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;
    const last = page.at(-1);

    return { items: page, nextCursor: hasMore && last ? last.position : null };
  }

  /** Избранное не листается: это короткий список ссылок, а не дерево. */
  async listFavorites(query: PageFavoritesQuery): Promise<PageListResult> {
    const items = await this.pages.listFavorites(query.workspaceId);

    return { items, nextCursor: null };
  }

  /** Корзина тоже плоская: восстановить страницу можно независимо от её родителя. */
  async listTrashed(query: PageTrashQuery): Promise<PageListResult> {
    const items = await this.pages.listTrashed(query.workspaceId);

    return { items, nextCursor: null };
  }

  async getPage(id: string, workspaceId?: string): Promise<Page> {
    const page = await this.pages.findById(id);

    if (!page) {
      throw new NotFoundError('Страница не найдена');
    }

    if (workspaceId !== undefined && page.workspaceId !== workspaceId) {
      // Чужой workspace отвечает так же, как несуществующая страница:
      // иначе по коду ответа можно перебором узнать о чужих данных.
      throw new NotFoundError('Страница не найдена');
    }

    return page;
  }

  async updatePage(id: string, workspaceId: string, patch: UpdatePageInput): Promise<Page> {
    await this.getPage(id, workspaceId);

    const updated = await this.pages.updateById(id, patch, this.now());

    if (!updated) {
      throw new NotFoundError('Страница не найдена');
    }

    return updated;
  }

  /**
   * Перемещение страницы в другого родителя с проверкой цикла.
   *
   * Цикл «страница внутрь собственного потомка» разрушил бы дерево:
   * страница стала бы недоступной. Проверяем по цепочке предков, а не
   * только по непосредственному родителю.
   */
  async movePage(id: string, workspaceId: string, input: MovePageInput): Promise<Page> {
    const page = await this.getPage(id, workspaceId);

    if (page.isTrashed) {
      throw new ConflictError('Нельзя перемещать страницу из корзины');
    }

    await this.assertParentIsUsable(workspaceId, input.parentId);
    await this.assertNoCycle(workspaceId, id, input.parentId);

    const bounds = await this.pages.findPositionBounds(
      workspaceId,
      input.parentId,
      input.afterPageId,
    );
    const updated = await this.pages.moveById(
      id,
      input.parentId,
      generateKeyBetween(bounds.before, bounds.after),
      this.now(),
    );

    if (!updated) {
      throw new NotFoundError('Страница не найдена');
    }

    return updated;
  }

  /** Проверка, что новый родитель не является самой страницей или её потомком. */
  private async assertNoCycle(
    workspaceId: string,
    pageId: string,
    newParentId: string | null,
  ): Promise<void> {
    if (newParentId === null) {
      return;
    }

    if (newParentId === pageId) {
      throw new ConflictError('Нельзя переместить страницу внутрь самой себя');
    }

    let current: string | null = newParentId;
    const visited = new Set<string>();

    while (current !== null) {
      if (visited.has(current)) {
        // Цикл уже есть в данных — не усугубляем его.
        throw new ConflictError('Обнаружен цикл в дереве страниц');
      }

      visited.add(current);

      if (current === pageId) {
        throw new ConflictError('Нельзя переместить страницу внутрь собственного потомка');
      }

      const parent = await this.pages.findById(current);

      if (parent === null || parent.workspaceId !== workspaceId) {
        return;
      }

      current = parent.parentId;
    }
  }

  /** Родитель должен существовать, принадлежать тому же workspace и не быть в корзине. */
  private async assertParentIsUsable(workspaceId: string, parentId: string | null): Promise<void> {
    if (parentId === null) {
      return;
    }

    const parent = await this.pages.findById(parentId);

    if (!parent) {
      throw new NotFoundError('Родительская страница не найдена');
    }

    if (parent.workspaceId !== workspaceId) {
      throw new ForbiddenError('Родительская страница принадлежит другому workspace');
    }

    if (parent.isTrashed) {
      throw new ConflictError('Нельзя создавать страницу внутри страницы в корзине');
    }
  }
}

/** Собирает сервис со всеми зависимостями: единственное место создания связей. */
export function createPageService(env: Bindings, clock: Clock = () => new Date()): PageService {
  return new PageService(new PageRepository(env), clock);
}

/** Идентификатор автора приходит из gateway; без него сервис страницу не создаёт. */
export function requireActorId(actorId: string | undefined | null): string {
  if (!actorId) {
    // На Этапе 1 подпись идентичности появится вместе с auth-service (Этап 2).
    // Пока это осознанное «fail closed»: нет контекста — нет записи.
    throw new ForbiddenError('Не удалось определить пользователя по контексту запроса');
  }

  return IdSchema.parse(actorId);
}
