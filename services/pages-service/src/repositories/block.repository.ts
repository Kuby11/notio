import { asc, desc, eq } from 'drizzle-orm';
import {
  BlockSchema,
  type Block,
  type BlockContent,
  type UpdateBlockInput,
} from '@notio/contracts';
import { createDb, type Db } from '@notio/db';
import type { Bindings } from '../env';
import { blocks, schema, type BlockRow } from '../db/schema';

type Database = Db<typeof schema>;

/** Block repository: the only place that knows about Drizzle and SQL. */
export class BlockRepository {
  private readonly db: Database;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  private toBlock(row: BlockRow): Block {
    return BlockSchema.parse({
      id: row.id,
      pageId: row.pageId,
      type: row.type,
      position: row.position,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  async findById(id: string): Promise<Block | null> {
    const [row] = await this.db.select().from(blocks).where(eq(blocks.id, id)).limit(1);

    return row ? this.toBlock(row) : null;
  }

  async listByPage(pageId: string): Promise<Block[]> {
    const rows = await this.db
      .select()
      .from(blocks)
      .where(eq(blocks.pageId, pageId))
      .orderBy(asc(blocks.position));

    return rows.map((row) => this.toBlock(row));
  }

  async create(block: {
    id: string;
    pageId: string;
    type: string;
    position: string;
    content: BlockContent;
    createdAt: string;
    updatedAt: string;
  }): Promise<Block> {
    const [row] = await this.db.insert(blocks).values(block).returning();

    if (!row) {
      throw new Error('D1 вернул пустой результат при вставке блока');
    }

    return this.toBlock(row);
  }

  async updateById(id: string, patch: UpdateBlockInput, updatedAt: string): Promise<Block | null> {
    const changes: Partial<typeof blocks.$inferInsert> = { updatedAt };

    if (patch.content !== undefined) {
      changes.content = patch.content;
      changes.type = patch.content.type;
    }

    const [updated] = await this.db
      .update(blocks)
      .set(changes)
      .where(eq(blocks.id, id))
      .returning();

    return updated ? this.toBlock(updated) : null;
  }

  async deleteById(id: string): Promise<void> {
    await this.db.delete(blocks).where(eq(blocks.id, id));
  }

  /** Bounds for the new position: last block + null (insert at the end). */
  async lastBlock(pageId: string): Promise<Block | null> {
    const [row] = await this.db
      .select()
      .from(blocks)
      .where(eq(blocks.pageId, pageId))
      .orderBy(desc(blocks.position))
      .limit(1);

    return row ? this.toBlock(row) : null;
  }

  async moveById(id: string, position: string, updatedAt: string): Promise<Block | null> {
    const [updated] = await this.db
      .update(blocks)
      .set({ position, updatedAt })
      .where(eq(blocks.id, id))
      .returning();

    return updated ? this.toBlock(updated) : null;
  }
}
