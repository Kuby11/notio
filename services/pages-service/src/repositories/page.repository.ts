import type { Bindings } from '../env';
import type { Page, UpdatePageInput } from '@notio/contracts';
import { PageSchema } from '@notio/contracts';
import { createDb } from '@notio/db';
import { and, asc, desc, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { pages, schema, type NewPageRow, type PageRow } from '../db/schema';

/** Bounds between which to generate the new page's position. */
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
 * D1 limits the number of bound parameters in a query. The id list is chunked
 * so hasChildren checks work even with `limit=100`.
 */
const CHILD_QUERY_CHUNK_SIZE = 90;

/** How many titles the search answers with: enough to scan, cheap to render. */
const SEARCH_RESULT_LIMIT = 50;

/**
 * How many recent pages are considered for a match.
 *
 * SQLite folds case for ASCII only (LIKE and lower() alike), so a Cyrillic
 * query like "дорожная" would never match "Дорожная". Folding is done in JS
 * — `String#toLowerCase` is Unicode-aware — over a bounded set of the most
 * recently edited pages: correct for every script and cheap at this scale.
 * A normalized column written on save would be the next step if workspaces
 * outgrow the bound.
 */
const SEARCH_CANDIDATE_LIMIT = 500;

/**
 * Page repository: the only place that knows about Drizzle and SQL. It exposes
 * domain objects validated by the PageSchema Zod schema — data from the
 * database is not trusted either.
 */
export class PageRepository {
  private readonly db: DrizzleD1Database<typeof schema>;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  private toPage(row: PageRow, hasChildren?: boolean): Page {
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
      isLocked: row.isLocked,
      ...(hasChildren === undefined ? {} : { hasChildren }),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  /** Parents from the list that have at least one child. */
  private async parentsWithChildren(
    workspaceId: string,
    parentIds: readonly string[],
    includeTrashed: boolean,
  ): Promise<Set<string>> {
    const uniqueIds = [...new Set(parentIds)];
    const result = new Set<string>();

    for (let offset = 0; offset < uniqueIds.length; offset += CHILD_QUERY_CHUNK_SIZE) {
      const chunk = uniqueIds.slice(offset, offset + CHILD_QUERY_CHUNK_SIZE);
      const conditions = [eq(pages.workspaceId, workspaceId), inArray(pages.parentId, chunk)];

      if (!includeTrashed) {
        conditions.push(eq(pages.isTrashed, false));
      }

      const rows = await this.db
        .select({ parentId: pages.parentId })
        .from(pages)
        .where(and(...conditions))
        .groupBy(pages.parentId);

      for (const row of rows) {
        if (row.parentId !== null) {
          result.add(row.parentId);
        }
      }
    }

    return result;
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

    const parents = await this.parentsWithChildren(
      filter.workspaceId,
      rows.map((row) => row.id),
      filter.includeTrashed,
    );

    return rows.map((row) => this.toPage(row, parents.has(row.id)));
  }

  /**
   * Favorites across the whole workspace.
   *
   * The list is flat and not tied to a parent: a favorited page can sit at any
   * depth. Trashed pages are not shown, and ordering by modification time puts
   * recently opened pages on top.
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
   * Every page of the workspace, flat, in tree order.
   *
   * The library view filters and sorts across the whole workspace and rebuilds
   * the nesting from `parentId` on the client, so the list cannot be assembled
   * level by level — that would cost one request per branch. `hasChildren` is
   * computed here too: the table draws the expand chevron from it.
   */
  async listAll(workspaceId: string): Promise<Page[]> {
    const rows = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), eq(pages.isTrashed, false)))
      .orderBy(asc(pages.position));

    const parents = await this.parentsWithChildren(
      workspaceId,
      rows.map((row) => row.id),
      false,
    );

    return rows.map((row) => this.toPage(row, parents.has(row.id)));
  }

  /** Deleted pages of the whole workspace: they can be restored from the trash. */
  async listTrashed(workspaceId: string): Promise<Page[]> {
    const rows = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), eq(pages.isTrashed, true)))
      .orderBy(desc(pages.updatedAt), desc(pages.id));

    return rows.map((row) => this.toPage(row));
  }

  /**
   * Title search across the workspace, most recently edited first.
   *
   * Case folding happens in JS (see SEARCH_CANDIDATE_LIMIT): SQLite folds
   * ASCII only, and a Cyrillic query must match a Cyrillic title regardless
   * of the case of its first letter. The escaped `%`/`_` are literal here —
   * `String#includes` has no wildcards.
   */
  async search(workspaceId: string, query: string): Promise<Page[]> {
    const needle = query.trim().toLowerCase();

    if (needle.length === 0) {
      return [];
    }

    const rows = await this.db
      .select()
      .from(pages)
      .where(and(eq(pages.workspaceId, workspaceId), eq(pages.isTrashed, false)))
      .orderBy(desc(pages.updatedAt), desc(pages.id))
      .limit(SEARCH_CANDIDATE_LIMIT);

    return rows
      .filter((row) => row.title.toLowerCase().includes(needle))
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((row) => this.toPage(row));
  }

  /**
   * Bounds for the new position.
   *
   * - without `afterPageId` the new page becomes the last in the list;
   * - with `afterPageId` it lands right after the specified sibling;
   * - if the sibling is not found under the same parent, the bounds are empty.
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

  /** The last child in display order: a new page is appended after it by default. */
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
    if (patch.isLocked !== undefined) {
      changes.isLocked = patch.isLocked;
    }

    const [updated] = await this.db.update(pages).set(changes).where(eq(pages.id, id)).returning();

    return updated ? this.toPage(updated) : null;
  }

  /**
   * Updates only the page's modification time. Called by the block service
   * after content edits: changing blocks is also a "document modified",
   * even though the page row itself needs no patch.
   */
  async touch(id: string, updatedAt: string): Promise<void> {
    await this.db.update(pages).set({ updatedAt }).where(eq(pages.id, id));
  }

  /** Move: changes parent and position atomically. */
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
