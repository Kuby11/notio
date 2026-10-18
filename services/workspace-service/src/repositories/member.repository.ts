import { and, eq } from 'drizzle-orm';
import { WorkspaceRoleSchema, type WorkspaceRole } from '@notio/contracts';
import { createDb, type Db } from '@notio/db';
import type { Bindings } from '../env';
import { schema, workspaceMembers } from '../db/schema';

type Database = Db<typeof schema>;

/** Участник в терминах сервиса: роль проверяется схемой, а не «на глаз». */
export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

/**
 * Репозиторий участников.
 *
 * Роль хранится строкой: набор ролей описан в contracts, и сервис не заводит
 * свой список — иначе матрица прав разъехалась бы с контрактом. Значения,
 * пришедшие из базы, проверяются схемой: мусор в колонке не должен пройти
 * в правила доступа молча.
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
      throw new Error('D1 вернул пустой результат при сохранении участника');
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
