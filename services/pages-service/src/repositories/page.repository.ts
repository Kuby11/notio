import type { Bindings } from '../env';
import type { Page, UpdatePageInput } from '@notio/contracts';
import { PageSchema } from '@notio/contracts';
import { createDb } from '@notio/db';
import { and, asc, desc, eq, gt, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { pages, schema, type NewPageRow, type PageRow } from '../db/schema';

/** Границы, между которыми нужно сгенерировать позицию новой страницы. */
export interface PositionBounds {
  before: string | null;
  after: string | null;
}

export interface ListChildrenFilter {
  workspaceId: string;
  parentId: string | null;
  includeTrashed: boolean;
  afterPosition?: string;
  limit: number;
}

/**
 * Репозиторий страниц: единственное место, которое знает про Drizzle и SQL.
 * Наружу отдаёт доменные объекты, валидированные Zod-схемой PageSchema —
 * данные из базы тоже не считаются доверенными.
 */
export class PageRepository {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  private toPage(row: PageRow): Page {
    return PageSchema.parse({
      id: row.id,
      workspaceId: row.workspaceId,
      parentId: row.parentId,
      title: row.title,
      icon: row.icon ?? undefined,
      coverFileId: row.coverFileId ?? undefined,
      position: row.position,
      isFavorite: row.isFavorite,
      isTrashed: row.isTrashed,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async create(row: NewPageRow): Promise<Page> {
    const [inserted] = await this.db.insert(pages).values(row).returning();

    if (!inserted) {
      throw new Error('D1 вернул пустой результат при вставке страницы');
    }

    return this.toPage(inserted);
  }

  async findById(id: string): Promise<Page | null> {
    const [row] = await this.db.select().from(pages).where(eq(pages.id, id)).limit(1);

    return row ? this.toPage(row) : null;
  }

  async listChildren(filter: ListChildrenFilter): Promise<Page[]> {
    const conditions = [
      eq(pages.workspaceId, filter.workspaceId),
      filter.parentId === null ? isNull(pages.parentId) : eq(pages.parentId, filter.parentId),
    ];

    if (!filter.includeTrashed) {
      conditions.push(eq(pages.isTrashed, false));
    }

    if (filter.afterPosition !== undefined) {
      conditions.push(gt(pages.position, filter.afterPosition));
    }

    const rows = await this.db
      .select()
      .from(pages)
      .where(and(...conditions))
      .orderBy(asc(pages.position))
      .limit(filter.limit);

    return rows.map((row) => this.toPage(row));
  }

  /**
   * Избранное всего workspace.
   *
   * Список плоский и не привязан к родителю: избранная страница может лежать
   * на любой глубине. Удалённые в корзину страницы не показываем, а порядок
   * по времени изменения ставит недавно открытые страницы наверх.
   */
  async listFavorites(workspaceId: string): Promise<Page[]> {
    const rows = await this.db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.workspaceId, workspaceId),
          eq(pages.isFavorite, true),
          eq(pages.isTrashed, false),
        ),
      )
      .orderBy(desc(pages.updatedAt), desc(pages.id));

    return rows.map((row) => this.toPage(row));
  }

  /**
   * Границы для новой позиции.
   *
   * - без `afterPageId` новая страница становится последней в списке;
   * - с `afterPageId` встаёт сразу после указанной соседней страницы;
   * - если сосед не найден в этом же родителе, границы пустые.
   */
  async findPositionBounds(
    workspaceId: string,
    parentId: string | null,
    afterPageId?: string,
  ): Promise<PositionBounds> {
    if (afterPageId === undefined) {
      const last = await this.lastChild(workspaceId, parentId);

      return { before: last?.position ?? null, after: null };
    }

    const anchor = await this.findById(afterPageId);

    if (!anchor || anchor.workspaceId !== workspaceId || anchor.parentId !== parentId) {
      return { before: null, after: null };
    }

    const [next] = await this.db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.workspaceId, workspaceId),
          parentId === null ? isNull(pages.parentId) : eq(pages.parentId, parentId),
          gt(pages.position, anchor.position),
        ),
      )
      .orderBy(asc(pages.position))
      .limit(1);

    return { before: anchor.position, after: next?.position ?? null };
  }

  async firstChild(workspaceId: string, parentId: string | null): Promise<Page | null> {
    const rows = await this.listChildren({
      workspaceId,
      parentId,
      includeTrashed: false,
      limit: 1,
    });

    return rows[0] ?? null;
  }

  /** Последний ребёнок в порядке отображения: новая страница по умолчанию встаёт после него. */
  async lastChild(workspaceId: string, parentId: string | null): Promise<Page | null> {
    const [row] = await this.db
      .select()
      .from(pages)
      .where(
        and(
          eq(pages.workspaceId, workspaceId),
          parentId === null ? isNull(pages.parentId) : eq(pages.parentId, parentId),
          eq(pages.isTrashed, false),
        ),
      )
      .orderBy(desc(pages.position))
      .limit(1);

    return row ? this.toPage(row) : null;
  }

  async updateById(id: string, patch: UpdatePageInput, updatedAt: string): Promise<Page | null> {
    const changes: Partial<NewPageRow> = { updatedAt };

    if (patch.title !== undefined) {
      changes.title = patch.title;
    }
    if (patch.icon !== undefined) {
      changes.icon = patch.icon;
    }
    if (patch.coverFileId !== undefined) {
      changes.coverFileId = patch.coverFileId;
    }
    if (patch.isFavorite !== undefined) {
      changes.isFavorite = patch.isFavorite;
    }
    if (patch.isTrashed !== undefined) {
      changes.isTrashed = patch.isTrashed;
    }

    const [updated] = await this.db.update(pages).set(changes).where(eq(pages.id, id)).returning();

    return updated ? this.toPage(updated) : null;
  }

  /** Перемещение: меняет родителя и позицию атомарно. */
  async moveById(
    id: string,
    parentId: string | null,
    position: string,
    updatedAt: string,
  ): Promise<Page | null> {
    const [updated] = await this.db
      .update(pages)
      .set({ parentId, position, updatedAt })
      .where(eq(pages.id, id))
      .returning();

    return updated ? this.toPage(updated) : null;
  }
}
