import {
  InvitationSchema,
  newId,
  roleCan,
  UserProfileListSchema,
  type ChangeMemberRoleInput,
  type CreateInvitationInput,
  type CreateWorkspaceInput,
  type Invitation,
  type Member,
  type UpdateWorkspaceInput,
  type UserProfile,
  type Workspace,
  type WorkspaceListItem,
  type WorkspacePermission,
  type WorkspaceRole,
} from '@notio/contracts';
import type { Bindings } from '../env';
import {
  ConflictError,
  ForbiddenError,
  InvitationError,
  NotFoundError,
  ValidationError,
} from '../errors';
import {
  InvitationRepository,
  type WorkspaceInvitation,
} from '../repositories/invitation.repository';
import { MemberRepository, type WorkspaceMember } from '../repositories/member.repository';
import { WorkspaceRepository } from '../repositories/workspace.repository';

/** The time source is injected so tests do not depend on the system clock. */
export type Clock = () => Date;

/** Name of the personal workspace when the user has none yet. */
export const DEFAULT_PERSONAL_WORKSPACE_NAME = 'Personal workspace';

export const INVITATION_TTL_DAYS = 7;

/** How long an archived workspace lives before cron deletes it. */
export const ARCHIVE_RETENTION_DAYS = 30;

export const MAX_ACTIVE_INVITATIONS = 20;

/** How many archived rows a single cron run deletes. */
export const PURGE_BATCH_LIMIT = 50;

/** Path of the users directory in auth-service: outside the gateway's public prefix. */
export const INTERNAL_USERS_URL = 'https://internal/internal/users';

/**
 * Transliterates a name into a slug.
 *
 * A full transliteration library is not needed here: the slug exists for links
 * and readability, and Cyrillic is simply dropped. An empty result is replaced
 * with 'workspace' so the address always stays valid.
 */
const CYRILLIC_MAP: Readonly<Record<string, string>> = {
  '\u0430': 'a',
  '\u0431': 'b',
  '\u0432': 'v',
  '\u0433': 'g',
  '\u0434': 'd',
  '\u0435': 'e',
  '\u0451': 'e',
  '\u0436': 'zh',
  '\u0437': 'z',
  '\u0438': 'i',
  '\u0439': 'y',
  '\u043a': 'k',
  '\u043b': 'l',
  '\u043c': 'm',
  '\u043d': 'n',
  '\u043e': 'o',
  '\u043f': 'p',
  '\u0440': 'r',
  '\u0441': 's',
  '\u0442': 't',
  '\u0443': 'u',
  '\u0444': 'f',
  '\u0445': 'h',
  '\u0446': 'c',
  '\u0447': 'ch',
  '\u0448': 'sh',
  '\u0449': 'sch',
  '\u044a': '',
  '\u044b': 'y',
  '\u044c': '',
  '\u044d': 'e',
  '\u044e': 'yu',
  '\u044f': 'ya',
};

export function slugify(name: string): string {
  const transliterated = [...name.toLowerCase()]
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return transliterated || 'workspace';
}

/** Cryptographically secure invitation token: 32 bytes in hex. */
export function createInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Workspace scenarios.
 *
 * This layer knows nothing about HTTP: no Request, no Response, no status
 * codes — only domain types and typed errors. Permissions are checked here,
 * not in the gateway: a valid token signature says nothing about who owns the resource.
 */
export class WorkspaceService {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly members: MemberRepository,
    private readonly invitations: InvitationRepository,
    private readonly env: Bindings,
    private readonly clock: Clock,
  ) {}

  private now(): string {
    return this.clock().toISOString();
  }

  /**
   * The user's workspace list together with their role in each.
   *
   * If there are no workspaces, a personal one is created: an empty screen with
   * a "create" button is an extra step for someone who just signed up.
   */
  async listForUser(actorId: string): Promise<WorkspaceListItem[]> {
    const memberships = await this.members.listByUser(actorId);

    if (memberships.length === 0) {
      const personal = await this.create(actorId, { name: DEFAULT_PERSONAL_WORKSPACE_NAME });

      return [{ ...personal, currentUserRole: 'owner' }];
    }

    const workspaces = await this.workspaces.listByIds(
      memberships.map((membership) => membership.workspaceId),
    );
    const active = workspaces.filter((workspace) => workspace.archivedAt === null);

    if (active.length === 0) {
      const personal = await this.create(actorId, { name: DEFAULT_PERSONAL_WORKSPACE_NAME });

      return [{ ...personal, currentUserRole: 'owner' }];
    }

    const roles = new Map(
      memberships.map((membership) => [membership.workspaceId, membership.role]),
    );

    return active.map((workspace) => ({
      ...workspace,
      currentUserRole: roles.get(workspace.id) ?? null,
    }));
  }

  /** Creates a workspace and makes its creator the owner. */
  async create(actorId: string, input: CreateWorkspaceInput): Promise<Workspace> {
    const now = this.now();
    const workspace = await this.workspaces.create({
      id: newId(),
      name: input.name,
      slug: await this.uniqueSlug(input.name),
      icon: input.icon ?? null,
      ownerId: actorId,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await this.members.upsert(workspace.id, actorId, 'owner', now);

    return workspace;
  }

  /** Read is available to members; an archived workspace is visible only to its owner. */
  async get(workspaceId: string, actorId: string): Promise<Workspace> {
    const role = await this.requirePermission(workspaceId, actorId, 'workspace:read');
    const workspace = await this.requireWorkspace(workspaceId);

    if (workspace.archivedAt !== null && role !== 'owner') {
      // The archive is hidden from members: otherwise they would see something that no longer works.
      throw new NotFoundError('Workspace not found');
    }

    return workspace;
  }

  async update(
    workspaceId: string,
    actorId: string,
    input: UpdateWorkspaceInput,
  ): Promise<Workspace> {
    await this.requirePermission(workspaceId, actorId, 'workspace:write');
    await this.requireWorkspace(workspaceId);

    const updated = await this.workspaces.update(workspaceId, {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      updatedAt: this.now(),
    });

    if (!updated) {
      throw new NotFoundError('Workspace not found');
    }

    return updated;
  }

  /**
   * Archiving is a soft delete with the right to restore. The row lives for
   * ARCHIVE_RETENTION_DAYS, then cron deletes it along with its members.
   */
  async archive(workspaceId: string, actorId: string): Promise<Workspace> {
    await this.requirePermission(workspaceId, actorId, 'workspace:archive');
    const now = this.now();

    const archived = await this.workspaces.update(workspaceId, {
      archivedAt: now,
      updatedAt: now,
    });

    if (!archived) {
      throw new NotFoundError('Workspace not found');
    }

    return archived;
  }

  async restore(workspaceId: string, actorId: string): Promise<Workspace> {
    await this.requirePermission(workspaceId, actorId, 'workspace:archive');
    const workspace = await this.requireWorkspace(workspaceId);

    if (workspace.archivedAt === null) {
      return workspace;
    }

    const restored = await this.workspaces.update(workspaceId, {
      archivedAt: null,
      updatedAt: this.now(),
    });

    if (!restored) {
      throw new NotFoundError('Workspace not found');
    }

    return restored;
  }

  /** Members with profiles: names and emails come from auth-service. */
  async listMembers(workspaceId: string, actorId: string): Promise<Member[]> {
    await this.requirePermission(workspaceId, actorId, 'workspace:read');

    const records = await this.members.listByWorkspace(workspaceId);
    const profiles = await this.fetchProfiles(records.map((record) => record.userId));
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));

    return records.map((record) => ({
      workspaceId: record.workspaceId,
      userId: record.userId,
      role: record.role,
      user: byId.get(record.userId) ?? { id: record.userId, email: '', name: '' },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  /** Changes a member's role. The last owner can be neither demoted nor removed. */
  async changeMemberRole(
    workspaceId: string,
    targetUserId: string,
    actorId: string,
    input: ChangeMemberRoleInput,
  ): Promise<Member> {
    await this.requirePermission(workspaceId, actorId, 'member:manage');
    const target = await this.requireMember(workspaceId, targetUserId);

    if (target.role === 'owner' && input.role !== 'owner') {
      await this.assertNotLastOwner(workspaceId);
    }

    const now = this.now();
    await this.members.updateRole(workspaceId, targetUserId, input.role, now);

    return this.memberView(workspaceId, targetUserId, input.role, now, now);
  }

  async removeMember(workspaceId: string, targetUserId: string, actorId: string): Promise<void> {
    await this.requirePermission(workspaceId, actorId, 'member:manage');
    const target = await this.requireMember(workspaceId, targetUserId);

    if (target.role === 'owner') {
      await this.assertNotLastOwner(workspaceId);
    }

    await this.members.delete(workspaceId, targetUserId);
  }

  async listInvitations(workspaceId: string, actorId: string): Promise<Invitation[]> {
    await this.requirePermission(workspaceId, actorId, 'invitation:manage');

    const records = await this.invitations.listActiveByWorkspace(workspaceId, this.now());

    return records.map((record) => this.invitationView(record));
  }

  /** Creates an invitation link: only the owner has the right. */
  async createInvitation(
    workspaceId: string,
    actorId: string,
    input: CreateInvitationInput,
  ): Promise<Invitation> {
    await this.requirePermission(workspaceId, actorId, 'invitation:manage');
    await this.requireWorkspace(workspaceId);

    const active = await this.invitations.listActiveByWorkspace(workspaceId, this.now());
    const max = this.numberSetting('MAX_ACTIVE_INVITATIONS', MAX_ACTIVE_INVITATIONS);

    if (active.length >= max) {
      throw new ConflictError(
        `Active invitation limit reached (${max}). Revoke some or wait for them to expire.`,
      );
    }

    const now = this.clock();
    const ttlDays = this.numberSetting('INVITATION_TTL_DAYS', INVITATION_TTL_DAYS);

    const record = await this.invitations.create({
      id: newId(),
      workspaceId,
      role: input.role,
      token: createInvitationToken(),
      invitedEmail: input.invitedEmail ?? null,
      createdBy: actorId,
      expiresAt: new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000).toISOString(),
      acceptedAt: null,
      createdAt: now.toISOString(),
    });

    return this.invitationView(record);
  }

  /** Accepting an invitation is the only way into someone else's workspace. */
  async acceptInvitation(token: string, actorId: string): Promise<Member> {
    const record = await this.invitations.findByToken(token);

    if (!record) {
      throw new NotFoundError('Invitation not found');
    }

    const now = this.clock();
    const expired = record.expiresAt <= now.toISOString();

    if (expired || record.acceptedAt !== null) {
      throw new InvitationError('The invitation link has expired or has already been used');
    }

    await this.requireWorkspace(record.workspaceId);
    await this.invitations.markAccepted(record.id, now.toISOString());

    const member = await this.members.upsert(
      record.workspaceId,
      actorId,
      record.role,
      now.toISOString(),
    );

    return this.memberView(
      record.workspaceId,
      actorId,
      member.role,
      member.createdAt,
      member.updatedAt,
    );
  }

  /** Revokes an invitation: only the owner has the right. */
  async revokeInvitation(workspaceId: string, token: string, actorId: string): Promise<void> {
    await this.requirePermission(workspaceId, actorId, 'invitation:manage');
    const record = await this.invitations.findByToken(token);

    if (!record || record.workspaceId !== workspaceId) {
      throw new NotFoundError('Invitation not found');
    }

    await this.invitations.delete(record.id);
  }

  /**
   * Cron: deletes archived workspaces whose retention has expired, plus
   * expired invitations. The archive is temporary by design.
   */
  async purgeExpired(): Promise<number> {
    const retentionDays = this.numberSetting('ARCHIVE_RETENTION_DAYS', ARCHIVE_RETENTION_DAYS);
    const cutoff = new Date(this.clock().getTime() - retentionDays * 24 * 60 * 60 * 1000);

    const expired = await this.workspaces.findExpiredArchives(
      cutoff.toISOString(),
      PURGE_BATCH_LIMIT,
    );

    for (const workspace of expired) {
      await this.workspaces.delete(workspace.id);
    }

    await this.invitations.deleteExpired(this.now());

    return expired.length;
  }

  /**
   * Role-based permission check.
   *
   * No membership — 404 with no details: otherwise brute force could reveal
   * which workspaces exist. Role present but insufficient — 403: the user
   * already knows the workspace is theirs.
   */
  private async requirePermission(
    workspaceId: string,
    actorId: string,
    permission: WorkspacePermission,
  ): Promise<WorkspaceRole> {
    const role = await this.members.findRole(workspaceId, actorId);

    if (role === null) {
      throw new NotFoundError('Workspace not found');
    }

    if (!roleCan(role, permission)) {
      throw new ForbiddenError('Not enough permissions for this action');
    }

    return role;
  }

  private async requireWorkspace(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaces.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundError('Workspace not found');
    }

    return workspace;
  }

  private async requireMember(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    const role = await this.members.findRole(workspaceId, userId);

    if (role === null) {
      throw new NotFoundError('Member not found');
    }

    return { workspaceId, userId, role, createdAt: '', updatedAt: '' };
  }

  /** At least one owner must remain, otherwise the workspace would have no master. */
  private async assertNotLastOwner(workspaceId: string): Promise<void> {
    if ((await this.members.countOwners(workspaceId)) <= 1) {
      throw new ValidationError(
        'An owner must remain: transfer ownership to another member before changing the role or removing them',
      );
    }
  }

  private async memberView(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
    createdAt: string,
    updatedAt: string,
  ): Promise<Member> {
    const [profile] = await this.fetchProfiles([userId]);

    return {
      workspaceId,
      userId,
      role,
      user: profile ?? { id: userId, email: '', name: '' },
      createdAt,
      updatedAt,
    };
  }

  private invitationView(record: WorkspaceInvitation): Invitation {
    return InvitationSchema.parse({
      ...record,
      inviteUrl: `${this.env.PUBLIC_APP_URL.replace(/\/$/, '')}/invite/${record.token}`,
    });
  }

  /**
   * User profiles live in auth-service: pulling them from there is cheaper than
   * duplicating emails and names in our own database and drifting from them
   * when access is revoked.
   */
  private async fetchProfiles(ids: string[]): Promise<UserProfile[]> {
    if (ids.length === 0) {
      return [];
    }

    const response = await this.env.AUTH_SERVICE.fetch(
      new Request(`${INTERNAL_USERS_URL}?ids=${ids.join(',')}`),
    );

    if (!response.ok) {
      throw new Error(`auth-service did not return profiles: HTTP ${response.status}`);
    }

    return UserProfileListSchema.parse(await response.json()).items;
  }

  /** Unique slug: append a number to the name until a free one is found. */
  private async uniqueSlug(name: string): Promise<string> {
    const base = slugify(name);

    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;

      if (!(await this.workspaces.slugExists(candidate))) {
        return candidate;
      }
    }

    return `${base}-${newId().slice(0, 8)}`;
  }

  /** Setting from vars; garbage in the config must not break the scenario. */
  private numberSetting(name: keyof Bindings, fallback: number): number {
    const parsed = Number.parseInt(String(this.env[name] ?? ''), 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}

export function createWorkspaceService(
  env: Bindings,
  clock: Clock = () => new Date(),
): WorkspaceService {
  return new WorkspaceService(
    new WorkspaceRepository(env),
    new MemberRepository(env),
    new InvitationRepository(env),
    env,
    clock,
  );
}

/** The actor id comes from the gateway; without it the service does not know whose request this is. */
export function requireActorId(actorId: string | undefined | null): string {
  if (!actorId) {
    // Fail closed: no confirmed identity — no action.
    throw new ForbiddenError('Could not identify the user from the request context');
  }

  return actorId;
}
