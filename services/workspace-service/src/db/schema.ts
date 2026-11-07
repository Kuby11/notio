/**
 * Schema of workspace-service.
 *
 * Its own database per service (database-per-service): pages and members share
 * no tables with pages-service, so permissions are checked against data that
 * belongs to this service.
 */
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Address part of the link: Latin letters, digits and hyphen. */
    slug: text('slug').notNull(),
    icon: text('icon'),
    ownerId: text('owner_id').notNull(),
    /** Soft delete: the row survives the retention period, then is cleaned up by cron. */
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('workspaces_slug_unique').on(table.slug),
    index('workspaces_owner_idx').on(table.ownerId),
  ],
);

export const workspaceMembers = sqliteTable(
  'workspace_members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    /** owner | editor | viewer — stored as a string, roles are described in contracts. */
    role: text('role').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('workspace_members_user_idx').on(table.userId),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** The role the invitee receives; owner is never granted by invitation. */
    role: text('role').notNull(),
    /** Secret part of the invitation link. */
    token: text('token').notNull(),
    invitedEmail: text('invited_email'),
    createdBy: text('created_by').notNull(),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('invitations_token_unique').on(table.token),
    index('invitations_workspace_idx').on(table.workspaceId),
  ],
);

export const databases = sqliteTable(
  'databases',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    parentId: text('parent_id'),
    title: text('title').notNull().default('Untitled Database'),
    description: text('description'),
    icon: text('icon'),
    coverFileId: text('cover_file_id'),
    isInline: integer('is_inline', { mode: 'boolean' }).notNull().default(false),
    /** Array of DatabasePropertySchema — the whole schema is one JSON column. */
    properties: text('properties', { mode: 'json' }).notNull(),
    defaultViewId: text('default_view_id'),
    isTrashed: integer('is_trashed', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('databases_workspace_idx').on(table.workspaceId, table.isTrashed)],
);

export const databaseRows = sqliteTable(
  'database_rows',
  {
    id: text('id').primaryKey(),
    databaseId: text('database_id').notNull(),
    workspaceId: text('workspace_id').notNull(),
    title: text('title').notNull().default(''),
    /** Record<propertyId, PropertyValue | null> as one JSON column. */
    properties: text('properties', { mode: 'json' }).notNull(),
    isTrashed: integer('is_trashed', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('database_rows_database_idx').on(table.databaseId, table.isTrashed)],
);

export const databaseViews = sqliteTable(
  'database_views',
  {
    id: text('id').primaryKey(),
    databaseId: text('database_id').notNull(),
    name: text('name').notNull(),
    type: text('type').notNull(),
    filter: text('filter', { mode: 'json' }),
    sorts: text('sorts', { mode: 'json' }),
    groupBy: text('group_by', { mode: 'json' }),
    chart: text('chart', { mode: 'json' }),
    visiblePropertyIds: text('visible_property_ids', { mode: 'json' }),
    columnWidths: text('column_widths', { mode: 'json' }),
    aggregations: text('aggregations', { mode: 'json' }),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('database_views_database_idx').on(table.databaseId)],
);

export const schema = {
  workspaces,
  workspaceMembers,
  invitations,
  databases,
  databaseRows,
  databaseViews,
};

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type NewWorkspaceRow = typeof workspaces.$inferInsert;
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMemberRow = typeof workspaceMembers.$inferInsert;
export type InvitationRow = typeof invitations.$inferSelect;
export type NewInvitationRow = typeof invitations.$inferInsert;
