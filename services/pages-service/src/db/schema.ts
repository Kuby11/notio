import type { BlockContent } from '@notio/contracts';
import { relations } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Database schema of pages-service.
 *
 * The service owns these tables alone (database-per-service): no tables are
 * shared with other services, relations live only inside pages-service.
 * Ids are UUIDv4 in TEXT, time is ISO-8601 in TEXT (deterministic and
 * readable), booleans are INTEGER.
 */
export const pages = sqliteTable(
  'pages',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    /** NULL — workspace root. The parent reference is stored in TEXT. */
    parentId: text('parent_id'),
    title: text('title').notNull().default(''),
    icon: text('icon'),
    coverFileId: text('cover_file_id'),
    /** Fractional indexing: neighbour order without rewriting on insert. */
    position: text('position').notNull(),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    isTrashed: integer('is_trashed', { mode: 'boolean' }).notNull().default(false),
    /** Page lock: content and title are read-only. */
    isLocked: integer('is_locked', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('pages_workspace_parent_position_idx').on(
      table.workspaceId,
      table.parentId,
      table.position,
    ),
    index('pages_workspace_updated_idx').on(table.workspaceId, table.updatedAt),
  ],
);

export const blocks = sqliteTable(
  'blocks',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    position: text('position').notNull(),
    /** JSON document of the block, validated by the BlockContentSchema Zod schema. */
    content: text('content', { mode: 'json' }).$type<BlockContent>().notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('blocks_page_position_idx').on(table.pageId, table.position)],
);

export const pagesRelations = relations(pages, ({ many }) => ({
  blocks: many(blocks),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
  page: one(pages, {
    fields: [blocks.pageId],
    references: [pages.id],
  }),
}));

export const pageVersions = sqliteTable(
  'page_versions',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    content: text('content', { mode: 'json' }).$type<unknown[]>().notNull(),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('page_versions_page_created_idx').on(table.pageId, table.createdAt)],
);

export const schema = { pages, blocks, pageVersions, pagesRelations, blocksRelations };

export type PageRow = typeof pages.$inferSelect;
export type NewPageRow = typeof pages.$inferInsert;
export type BlockRow = typeof blocks.$inferSelect;
export type NewBlockRow = typeof blocks.$inferInsert;
