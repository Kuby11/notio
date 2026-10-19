import { desc, eq } from 'drizzle-orm';
import { createDb, type Db } from '@notio/db';
import { PageVersionSchema, type PageVersion } from '@notio/contracts';
import type { Bindings } from '../env';
import { schema, pageVersions } from '../db/schema';

type Database = Db<typeof schema>;

/** Репозиторий версий страниц: полные снапшоты, а не диффы. */
export class PageVersionRepository {
  private readonly db: Database;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  async create(version: typeof pageVersions.$inferInsert): Promise<PageVersion> {
    const [row] = await this.db.insert(pageVersions).values(version).returning();

    if (!row) {
      throw new Error('D1 вернул пустой результат при вставке версии');
    }

    return PageVersionSchema.parse({
      id: row.id,
      pageId: row.pageId,
      content: row.content,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    });
  }

  async listByPage(pageId: string, limit = 50): Promise<PageVersion[]> {
    const rows = await this.db
      .select()
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId))
      .orderBy(desc(pageVersions.createdAt))
      .limit(limit);

    return rows.map((row) =>
      PageVersionSchema.parse({
        id: row.id,
        pageId: row.pageId,
        content: row.content,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
      }),
    );
  }

  async findById(id: string): Promise<PageVersion | null> {
    const [row] = await this.db.select().from(pageVersions).where(eq(pageVersions.id, id)).limit(1);

    return row
      ? PageVersionSchema.parse({
          id: row.id,
          pageId: row.pageId,
          content: row.content,
          createdBy: row.createdBy,
          createdAt: row.createdAt,
        })
      : null;
  }

  /** Удаляет старые версии, оставляя только последние `keep`. */
  async prune(pageId: string, keep: number): Promise<void> {
    const rows = await this.db
      .select({ id: pageVersions.id })
      .from(pageVersions)
      .where(eq(pageVersions.pageId, pageId))
      .orderBy(desc(pageVersions.createdAt));

    if (rows.length <= keep) {
      return;
    }

    const toDelete = rows.slice(keep).map((row) => row.id);

    for (const id of toDelete) {
      await this.db.delete(pageVersions).where(eq(pageVersions.id, id));
    }
  }
}
