/**
 * Schema of workspace-service.
 *
 * Its own database per service (database-per-service): pages and members share
 * no tables with pages-service, so permissions are checked against data that
 * belongs to this service.
 */
import { index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

export const schema = { workspaces, workspaceMembers, invitations };

export type WorkspaceRow = typeof workspaces.$inferSelect;
export type NewWorkspaceRow = typeof workspaces.$inferInsert;
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMemberRow = typeof workspaceMembers.$inferInsert;
export type InvitationRow = typeof invitations.$inferSelect;
export type NewInvitationRow = typeof invitations.$inferInsert;
