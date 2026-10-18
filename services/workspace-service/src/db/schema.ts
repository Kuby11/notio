/**
 * Схема workspace-service.
 *
 * Своя база на сервис (database-per-service): страницы и участники не делят
 * таблицы с pages-service, поэтому права проверяются по данным, которые
 * принадлежат этому сервису.
 */
import { index, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Адресная часть ссылки: латиница, цифры и дефис. */
    slug: text('slug').notNull(),
    icon: text('icon'),
    ownerId: text('owner_id').notNull(),
    /** Мягкое удаление: запись переживает срок ретенции, затем чистится по cron. */
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
    /** owner | editor | viewer — хранится строкой, роли описаны в contracts. */
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
    /** Роль, которую получит принявший приглашение; owner через приглашение не выдаётся. */
    role: text('role').notNull(),
    /** Секретная часть ссылки-приглашения. */
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
