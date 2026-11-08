import { and, eq } from 'drizzle-orm';
import { WorkspaceRoleSchema, type WorkspaceRole } from '@notio/contracts';
import { createDb, type Db } from '@notio/db';
import type { Bindings } from '../env';
import { schema, workspaceMembers } from '../db/schema';

type Database = Db<typeof schema>;

/** Member in the service's terms: the role is checked by schema, not by eye. */
export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * Member repository.
 *
 * The role is stored as a string: the role set is described in contracts and
 * the service keeps no list of its own — otherwise the permission matrix would
 * drift from the contract. Values coming from the database are checked by the
 * schema: garbage in a column must not silently reach access rules.
 */
export class MemberRepository {
  private readonly db: Database;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  private toMember(row: typeof workspaceMembers.$inferSelect): WorkspaceMember {
    return { ...row, role: WorkspaceRoleSchema.parse(row.role) };
  }

  async findRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
    const [row] = await this.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
      )
      .limit(1);

    return row ? WorkspaceRoleSchema.parse(row.role) : null;
  }

  async listByWorkspace(workspaceId: string): Promise<WorkspaceMember[]> {
    const rows = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    return rows.map((row) => this.toMember(row));
  }

  async listByUser(userId: string): Promise<WorkspaceMember[]> {
    const rows = await this.db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId));

    return rows.map((row) => this.toMember(row));
  }

  async upsert(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    now: string,
  ): Promise<WorkspaceMember> {
    const [row] = await this.db
      .insert(workspaceMembers)
      .values({ workspaceId, userId, role, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { role, updatedAt: now },
      })
      .returning();

    if (!row) {
      throw new Error('D1 returned an empty result while saving a member');
    }

    return this.toMember(row);
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    now: string,
  ): Promise<void> {
    await this.db
      .update(workspaceMembers)
      .set({ role, updatedAt: now })
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
      );
  }

  async delete(workspaceId: string, userId: string): Promise<void> {
    await this.db
      .delete(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
      );
  }

  async countOwners(workspaceId: string): Promise<number> {
    const rows = await this.db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')),
      );

    return rows.length;
  }
}
