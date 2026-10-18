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

/** Источник времени внедряется, чтобы тесты не зависели от системных часов. */
export type Clock = () => Date;

/** Название личного пространства, если у пользователя ещё нет ни одного. */
export const DEFAULT_PERSONAL_WORKSPACE_NAME = 'Личное пространство';

/** Сколько дней живёт ссылка-приглашение. */
export const INVITATION_TTL_DAYS = 7;

/** Сколько дней живёт архивный workspace, прежде чем его удалит cron. */
export const ARCHIVE_RETENTION_DAYS = 30;

/** Максимум активных приглашений на workspace. */
export const MAX_ACTIVE_INVITATIONS = 20;

/** Сколько архивных записей удаляет один запуск cron. */
export const PURGE_BATCH_LIMIT = 50;

/** Путь каталога пользователей в auth-service: вне публичного префикса gateway. */
export const INTERNAL_USERS_URL = 'https://internal/internal/users';

/**
 * Транслитерация названия в slug.
 *
 * Полноценная библиотека транслитерации здесь не нужна: slug используется
 * для ссылок и читаемости, а кириллица просто отбрасывается. Пустой результат
 * заменяем на 'workspace', чтобы адрес всегда оставался валидным.
 */
const CYRILLIC_MAP: Readonly<Record<string, string>> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
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

/** Криптостойкий токен приглашения: 32 байта в hex. */
export function createInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Сценарии рабочих пространств.
 *
 * Слой не знает про HTTP: ни Request, ни Response, ни кодов статусов — только
 * доменные типы и типизированные ошибки. Права проверяются здесь, а не в
 * gateway: подпись токена не говорит, кому принадлежит ресурс.
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
   * Список workspace пользователя вместе с его ролью в каждом.
   *
   * Если пространств нет, создаётся личное: пустой экран с кнопкой «создать»
   * — лишний шаг для человека, который только что зарегистрировался.
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

  /** Создаёт workspace и делает создателя владельцем. */
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

  /** Чтение доступно участнику; архивный виден только владельцу. */
  async get(workspaceId: string, actorId: string): Promise<Workspace> {
    const role = await this.requirePermission(workspaceId, actorId, 'workspace:read');
    const workspace = await this.requireWorkspace(workspaceId);

    if (workspace.archivedAt !== null && role !== 'owner') {
      // Архив скрыт от участников: иначе они увидят то, что уже не работает.
      throw new NotFoundError('Рабочее пространство не найдено');
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
      throw new NotFoundError('Рабочее пространство не найдено');
    }

    return updated;
  }

  /**
   * Архивирование — мягкое удаление с правом возврата. Запись живёт
   * ARCHIVE_RETENTION_DAYS, затем её удаляет cron вместе с участниками.
   */
  async archive(workspaceId: string, actorId: string): Promise<Workspace> {
    await this.requirePermission(workspaceId, actorId, 'workspace:archive');
    const now = this.now();

    const archived = await this.workspaces.update(workspaceId, {
      archivedAt: now,
      updatedAt: now,
    });

    if (!archived) {
      throw new NotFoundError('Рабочее пространство не найдено');
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
      throw new NotFoundError('Рабочее пространство не найдено');
    }

    return restored;
  }

  /** Участники с профилями: имена и почты приходят из auth-service. */
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

  /** Смена роли участника. Последнего owner понизить или удалить нельзя. */
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

  /** Создание ссылки-приглашения: право есть только у владельца. */
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
        `Достигнут лимит активных приглашений (${max}). Отзовите лишние или дождитесь истечения срока.`,
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

  /** Принятие приглашения — единственный путь попасть в чужой workspace. */
  async acceptInvitation(token: string, actorId: string): Promise<Member> {
    const record = await this.invitations.findByToken(token);

    if (!record) {
      throw new NotFoundError('Приглашение не найдено');
    }

    const now = this.clock();
    const expired = record.expiresAt <= now.toISOString();

    if (expired || record.acceptedAt !== null) {
      throw new InvitationError('Ссылка-приглашение истекла или уже использована');
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

  /** Отзыв приглашения: право есть только у владельца. */
  async revokeInvitation(workspaceId: string, token: string, actorId: string): Promise<void> {
    await this.requirePermission(workspaceId, actorId, 'invitation:manage');
    const record = await this.invitations.findByToken(token);

    if (!record || record.workspaceId !== workspaceId) {
      throw new NotFoundError('Приглашение не найдено');
    }

    await this.invitations.delete(record.id);
  }

  /**
   * Cron: удаляет архивные workspace, у которых истёк срок ретенции, и
   * протухшие приглашения. Архив временный по замыслу.
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
   * Проверка права по роли.
   *
   * Нет членства — 404 без деталей: иначе перебором можно было бы узнать,
   * какие workspace существуют. Роль есть, но права не хватает — 403:
   * пользователь и так знает, что этот workspace его.
   */
  private async requirePermission(
    workspaceId: string,
    actorId: string,
    permission: WorkspacePermission,
  ): Promise<WorkspaceRole> {
    const role = await this.members.findRole(workspaceId, actorId);

    if (role === null) {
      throw new NotFoundError('Рабочее пространство не найдено');
    }

    if (!roleCan(role, permission)) {
      throw new ForbiddenError('Недостаточно прав для этого действия');
    }

    return role;
  }

  private async requireWorkspace(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaces.findById(workspaceId);

    if (!workspace) {
      throw new NotFoundError('Рабочее пространство не найдено');
    }

    return workspace;
  }

  private async requireMember(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    const role = await this.members.findRole(workspaceId, userId);

    if (role === null) {
      throw new NotFoundError('Участник не найден');
    }

    return { workspaceId, userId, role, createdAt: '', updatedAt: '' };
  }

  /** Владелец должен остаться хотя бы один, иначе workspace останется без хозяина. */
  private async assertNotLastOwner(workspaceId: string): Promise<void> {
    if ((await this.members.countOwners(workspaceId)) <= 1) {
      throw new ValidationError(
        'Владелец должен остаться: передайте права другому участнику перед сменой роли или удалением',
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
   * Профили пользователей живут в auth-service: забрать их оттуда дешевле,
   * чем дублировать почты и имена в своей базе и разойтись с ними при отзыве.
   */
  private async fetchProfiles(ids: string[]): Promise<UserProfile[]> {
    if (ids.length === 0) {
      return [];
    }

    const response = await this.env.AUTH_SERVICE.fetch(
      new Request(`${INTERNAL_USERS_URL}?ids=${ids.join(',')}`),
    );

    if (!response.ok) {
      throw new Error(`auth-service не отдал профили: HTTP ${response.status}`);
    }

    return UserProfileListSchema.parse(await response.json()).items;
  }

  /** Уникальный slug: к названию добавляем номер, пока не найдём свободный. */
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

  /** Настройка из vars; мусор в конфиге не должен ломать сценарий. */
  private numberSetting(name: keyof Bindings, fallback: number): number {
    const parsed = Number.parseInt(String(this.env[name] ?? ''), 10);

    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}

/** Собирает сервис со всеми зависимостями: единственное место создания связей. */
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

/** Идентификатор актора приходит от gateway; без него сервис не знает, чей запрос. */
export function requireActorId(actorId: string | undefined | null): string {
  if (!actorId) {
    // Fail closed: нет подтверждённой идентичности — нет действия.
    throw new ForbiddenError('Не удалось определить пользователя по контексту запроса');
  }

  return actorId;
}
