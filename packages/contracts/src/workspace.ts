import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema, SlugSchema } from './ids';

export const WORKSPACE_ROLES = ['owner', 'editor', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const WorkspaceRoleSchema = z.enum(WORKSPACE_ROLES);

export const WorkspaceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1).max(120),
  slug: SlugSchema,
  icon: z.string().max(16).optional(),
  ownerId: IdSchema,
  /** Мягкое удаление: после архивации workspace ещё какое-то время доступен владельцу. */
  archivedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

/** Права, которые роль разрешает: матрица живёт в одном месте и покрыта тестами. */
export const WORKSPACE_PERMISSIONS = [
  'workspace:read',
  'workspace:write',
  'workspace:archive',
  'member:manage',
  'invitation:manage',
  'page:read',
  'page:write',
] as const;

export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, readonly WorkspacePermission[]>> = {
  owner: [
    'workspace:read',
    'workspace:write',
    'workspace:archive',
    'member:manage',
    'invitation:manage',
    'page:read',
    'page:write',
  ],
  editor: ['workspace:read', 'page:read', 'page:write'],
  viewer: ['workspace:read', 'page:read'],
};

export function roleCan(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Участник workspace с краткими данными пользователя. */
export const MemberSchema = z.object({
  workspaceId: IdSchema,
  userId: IdSchema,
  role: WorkspaceRoleSchema,
  user: z.object({
    id: IdSchema,
    email: z.email(),
    name: z.string(),
  }),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Member = z.infer<typeof MemberSchema>;

export const MemberListSchema = z.object({ items: z.array(MemberSchema) });

/**
 * Приглашение по ссылке: токен — единственное доказательство права войти.
 * Почта необязательна: ссылку можно передать любым способом.
 */
export const InvitationSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  role: WorkspaceRoleSchema,
  /** Секретная часть ссылки; в списках наружу не отдаётся. */
  token: z.string().min(20).max(200),
  invitedEmail: z.email().nullable(),
  /** Ссылка, которую можно отправить приглашённому. */
  inviteUrl: z.string().min(1).max(500),
  createdBy: IdSchema,
  expiresAt: IsoDateTimeSchema,
  acceptedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Invitation = z.infer<typeof InvitationSchema>;

export const InvitationListSchema = z.object({ items: z.array(InvitationSchema) });

export const CreateWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1, 'Название не может быть пустым').max(120),
  icon: z.string().max(16).optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;

export const UpdateWorkspaceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    icon: z.string().max(16).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Нужно передать хотя бы одно поле',
  });
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceInputSchema>;

export const ChangeMemberRoleInputSchema = z.object({
  role: WorkspaceRoleSchema,
});
export type ChangeMemberRoleInput = z.infer<typeof ChangeMemberRoleInputSchema>;

export const CreateInvitationInputSchema = z.object({
  role: WorkspaceRoleSchema.exclude(['owner']),
  /** Почта не обязательна: приглашение живёт по ссылке. */
  invitedEmail: z.email().optional(),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;

/** Ссылка-приглашение, отдельная от записи: сервису нужен только токен. */
export const AcceptInvitationInputSchema = z.object({
  token: z.string().min(20).max(200),
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationInputSchema>;

/**
 * Workspace вместе с ролью текущего пользователя.
 *
 * Роль едет в том же ответе, что и список: иначе интерфейс делал бы отдельный
 * запрос на каждое пространство, чтобы понять, какие действия показать.
 */
export const WorkspaceListItemSchema = WorkspaceSchema.extend({
  currentUserRole: WorkspaceRoleSchema.nullable(),
});
export type WorkspaceListItem = z.infer<typeof WorkspaceListItemSchema>;

export const WorkspaceListSchema = z.object({ items: z.array(WorkspaceListItemSchema) });

/** Разбор id из пути: невалидный id — ошибка 400, а не 404. */
export const WorkspaceIdParamsSchema = z.object({ id: IdSchema });
export const MemberParamsSchema = z.object({ id: IdSchema, userId: IdSchema });
export const InvitationTokenParamsSchema = z.object({ token: z.string().min(20).max(200) });
