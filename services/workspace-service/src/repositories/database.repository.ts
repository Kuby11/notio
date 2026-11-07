import { and, asc, eq } from 'drizzle-orm';
import {
  DatabaseRowSchema,
  DatabaseSchema,
  DatabaseViewSchema,
  type Database,
  type DatabaseRow,
  type DatabaseView,
} from '@notio/contracts';
import { createDb, type Db } from '@notio/db';
import type { Bindings } from '../env';
import { schema, databaseRows, databases, databaseViews } from '../db/schema';

type Database_ = Db<typeof schema>;

/**
 * Database repository: the only place that knows about Drizzle and SQL.
 * JSON columns are parsed by the contract schemas on the way out — data from
 * the database is not trusted either.
 */
export class DatabaseRepository {
  private readonly db: Database_;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  private toDatabase(row: typeof databases.$inferSelect): Database {
    return DatabaseSchema.parse({
      id: row.id,
      workspaceId: row.workspaceId,
      parentId: row.parentId,
      title: row.title,
      ...(row.description === null ? {} : { description: row.description }),
      ...(row.icon === null ? {} : { icon: row.icon }),
      ...(row.coverFileId === null ? {} : { coverFileId: row.coverFileId }),
      isInline: row.isInline,
      properties: row.properties,
      ...(row.defaultViewId === null ? {} : { defaultViewId: row.defaultViewId }),
      isTrashed: row.isTrashed,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toRow(row: typeof databaseRows.$inferSelect): DatabaseRow {
    return DatabaseRowSchema.parse({
      id: row.id,
      databaseId: row.databaseId,
      workspaceId: row.workspaceId,
      title: row.title,
      properties: row.properties,
      isTrashed: row.isTrashed,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  private toView(row: typeof databaseViews.$inferSelect): DatabaseView {
    return DatabaseViewSchema.parse({
      id: row.id,
      databaseId: row.databaseId,
      name: row.name,
      type: row.type,
      ...(row.filter === null ? {} : { filter: row.filter }),
      sorts: row.sorts ?? [],
      ...(row.groupBy === null ? {} : { groupBy: row.groupBy }),
      ...(row.chart === null ? {} : { chart: row.chart }),
      visiblePropertyIds: row.visiblePropertyIds ?? [],
      ...(row.columnWidths === null ? {} : { columnWidths: row.columnWidths }),
      ...(row.aggregations === null ? {} : { aggregations: row.aggregations }),
    });
  }

  async insertDatabase(row: typeof databases.$inferInsert): Promise<void> {
    await this.db.insert(databases).values(row);
  }

  async findById(id: string): Promise<Database | null> {
    const [row] = await this.db.select().from(databases).where(eq(databases.id, id)).limit(1);

    return row ? this.toDatabase(row) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<Database[]> {
    const rows = await this.db
      .select()
      .from(databases)
      .where(and(eq(databases.workspaceId, workspaceId), eq(databases.isTrashed, false)))
      .orderBy(asc(databases.createdAt));

    return rows.map((row) => this.toDatabase(row));
  }

  async updateById(
    id: string,
    changes: Partial<typeof databases.$inferInsert>,
  ): Promise<Database | null> {
    const [row] = await this.db
      .update(databases)
      .set(changes)
      .where(eq(databases.id, id))
      .returning();

    return row ? this.toDatabase(row) : null;
  }

  async insertRow(row: typeof databaseRows.$inferInsert): Promise<void> {
    await this.db.insert(databaseRows).values(row);
  }

  async findRowById(id: string): Promise<DatabaseRow | null> {
    const [row] = await this.db.select().from(databaseRows).where(eq(databaseRows.id, id)).limit(1);

    return row ? this.toRow(row) : null;
  }

  async listRows(databaseId: string): Promise<DatabaseRow[]> {
    const rows = await this.db
      .select()
      .from(databaseRows)
      .where(and(eq(databaseRows.databaseId, databaseId), eq(databaseRows.isTrashed, false)))
      .orderBy(asc(databaseRows.createdAt));

    return rows.map((row) => this.toRow(row));
  }

  async updateRowById(
    id: string,
    changes: Partial<typeof databaseRows.$inferInsert>,
  ): Promise<DatabaseRow | null> {
    const [row] = await this.db
      .update(databaseRows)
      .set(changes)
      .where(eq(databaseRows.id, id))
      .returning();

    return row ? this.toRow(row) : null;
  }

  async deleteRowById(id: string): Promise<void> {
    await this.db.delete(databaseRows).where(eq(databaseRows.id, id));
  }

  async insertView(row: typeof databaseViews.$inferInsert): Promise<void> {
    await this.db.insert(databaseViews).values(row);
  }

  async findViewById(id: string): Promise<DatabaseView | null> {
    const [row] = await this.db
      .select()
      .from(databaseViews)
      .where(eq(databaseViews.id, id))
      .limit(1);

    return row ? this.toView(row) : null;
  }

  async listViews(databaseId: string): Promise<DatabaseView[]> {
    const rows = await this.db
      .select()
      .from(databaseViews)
      .where(eq(databaseViews.databaseId, databaseId))
      .orderBy(asc(databaseViews.createdAt));

    return rows.map((row) => this.toView(row));
  }

  async updateViewById(
    id: string,
    changes: Partial<typeof databaseViews.$inferInsert>,
  ): Promise<DatabaseView | null> {
    const [row] = await this.db
      .update(databaseViews)
      .set(changes)
      .where(eq(databaseViews.id, id))
      .returning();

    return row ? this.toView(row) : null;
  }

  async deleteViewById(id: string): Promise<void> {
    await this.db.delete(databaseViews).where(eq(databaseViews.id, id));
  }

  /** Removes every view of a database when the database itself is deleted. */
  async deleteViewsByDatabase(databaseId: string): Promise<void> {
    await this.db.delete(databaseViews).where(eq(databaseViews.databaseId, databaseId));
  }
}
