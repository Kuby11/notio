import { and, eq, isNull, lte } from 'drizzle-orm';
import { InvitationSchema, type WorkspaceRole } from '@notio/contracts';
import { createDb, type Db } from '@notio/db';
import type { Bindings } from '../env';
import { invitations, schema } from '../db/schema';

type Database = Db<typeof schema>;

/**
 * Приглашение в терминах сервиса: без inviteUrl, его собирает сценарий.
 * Токен — единственное доказательство права войти, поэтому он хранится здесь.
 */
export interface WorkspaceInvitation {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  token: string;
  invitedEmail: string | null;
  createdBy: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

export class InvitationRepository {
  private readonly db: Database;

  constructor(env: Bindings) {
    this.db = createDb(env, schema);
  }

  private toInvitation(row: typeof invitations.$inferSelect): WorkspaceInvitation {
    return InvitationSchema.omit({ inviteUrl: true }).parse(row);
  }

  async create(invitation: typeof invitations.$inferInsert): Promise<WorkspaceInvitation> {
    const [row] = await this.db.insert(invitations).values(invitation).returning();

    if (!row) {
      throw new Error('D1 вернул пустой результат при вставке приглашения');
    }

    return this.toInvitation(row);
  }

  async findByToken(token: string): Promise<WorkspaceInvitation | null> {
    const [row] = await this.db
      .select()
      .from(invitations)
      .where(eq(invitations.token, token))
      .limit(1);

    return row ? this.toInvitation(row) : null;
  }

  /** Приглашения, которые ещё можно принять: не истёкшие и не использованные. */
  async listActiveByWorkspace(workspaceId: string, now: string): Promise<WorkspaceInvitation[]> {
    const rows = await this.db
      .select()
      .from(invitations)
      .where(and(eq(invitations.workspaceId, workspaceId), isNull(invitations.acceptedAt)));

    return rows.filter((row) => row.expiresAt > now).map((row) => this.toInvitation(row));
  }

  async markAccepted(id: string, acceptedAt: string): Promise<void> {
    await this.db.update(invitations).set({ acceptedAt }).where(eq(invitations.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(invitations).where(eq(invitations.id, id));
  }

  /** Чистит протухшие приглашения: их незачем хранить после срока. */
  async deleteExpired(now: string): Promise<void> {
    await this.db
      .delete(invitations)
      .where(and(isNull(invitations.acceptedAt), lte(invitations.expiresAt, now)));
  }
}
