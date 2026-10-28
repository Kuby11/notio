import { and, eq, inArray, isNotNull, lte } from 'drizzle-orm';
import { WorkspaceSchema, type Workspace } from '@notio/contracts';
import { createDb, type Db } from '@notio/db';
import type { Bindings } from '../env';
import { schema, workspaces, type WorkspaceRow } from '../db/schema';

type Database = Db<typeof schema>;

/**
 * Workspace repository: the only place that knows about Drizzle and SQL. It
 * exposes domain objects checked by the WorkspaceSchema Zod schema — data from
 * the database is not trusted either.
 */
export class WorkspaceRepository {
  private readonly db: Database;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  private toWorkspace(row: WorkspaceRow): Workspace {
    return WorkspaceSchema.parse({
      id: row.id,
      name: row.name,
      slug: row.slug,
      icon: row.icon ?? undefined,
      ownerId: row.ownerId,
      archivedAt: row.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findById(id: string): Promise<Workspace | null> {
    const [row] = await this.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);

    return row ? this.toWorkspace(row) : null;
  }

  async findBySlug(slug: string): Promise<Workspace | null> {
    const [row] = await this.db.select().from(workspaces).where(eq(workspaces.slug, slug)).limit(1);

    return row ? this.toWorkspace(row) : null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);

    return row !== undefined;
  }

  async create(workspace: typeof workspaces.$inferInsert): Promise<Workspace> {
    const [row] = await this.db.insert(workspaces).values(workspace).returning();

    if (!row) {
      throw new Error('D1 вернул пустой результат при вставке workspace');
    }

    return this.toWorkspace(row);
  }

  async update(
    id: string,
    changes: Partial<Pick<WorkspaceRow, 'name' | 'icon' | 'archivedAt' | 'updatedAt'>>,
  ): Promise<Workspace | null> {
    const [row] = await this.db
      .update(workspaces)
      .set(changes)
      .where(eq(workspaces.id, id))
      .returning();

    return row ? this.toWorkspace(row) : null;
  }

  async listByIds(ids: string[]): Promise<Workspace[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await this.db.select().from(workspaces).where(inArray(workspaces.id, ids));

    return rows.map((row) => this.toWorkspace(row));
  }

  /**
   * Archived workspaces whose retention period has expired.
   * The archive is temporary: without this query deleted workspaces would pile up forever.
   */
  async findExpiredArchives(cutoff: string, limit: number): Promise<Workspace[]> {
    const rows = await this.db
      .select()
      .from(workspaces)
      .where(and(isNotNull(workspaces.archivedAt), lte(workspaces.archivedAt, cutoff)))
      .limit(limit);

    return rows.map((row) => this.toWorkspace(row));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(workspaces).where(eq(workspaces.id, id));
  }
}
