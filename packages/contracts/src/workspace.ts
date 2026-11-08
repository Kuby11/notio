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
  /** Soft delete: after archiving the workspace stays reachable by its owner for a while. */
  archivedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

/** What each role allows: the matrix lives in one place and is covered by tests. */
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
 * Invitation by link: the token is the only proof of the right to join.
 * The email is optional — the link can be passed along any way.
 */
export const InvitationSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  role: WorkspaceRoleSchema,
  /** The secret part of the link; never included in list responses. */
  token: z.string().min(20).max(200),
  invitedEmail: z.email().nullable(),
  inviteUrl: z.string().min(1).max(500),
  createdBy: IdSchema,
  expiresAt: IsoDateTimeSchema,
  acceptedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
});
export type Invitation = z.infer<typeof InvitationSchema>;

export const InvitationListSchema = z.object({ items: z.array(InvitationSchema) });

export const CreateWorkspaceInputSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(120),
  icon: z.string().max(16).optional(),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceInputSchema>;

export const UpdateWorkspaceInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    icon: z.string().max(16).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceInputSchema>;

export const ChangeMemberRoleInputSchema = z.object({
  role: WorkspaceRoleSchema,
});
export type ChangeMemberRoleInput = z.infer<typeof ChangeMemberRoleInputSchema>;

export const CreateInvitationInputSchema = z.object({
  role: WorkspaceRoleSchema.exclude(['owner']),
  /** The email is optional: the invitation lives on the link. */
  invitedEmail: z.email().optional(),
});
export type CreateInvitationInput = z.infer<typeof CreateInvitationInputSchema>;

/** The invitation link, separate from the record: the service only needs the token. */
export const AcceptInvitationInputSchema = z.object({
  token: z.string().min(20).max(200),
});
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationInputSchema>;

/**
 * Workspace together with the current user's role.
 *
 * The role travels in the same response as the list: otherwise the UI would
 * make a separate request per workspace just to decide which actions to show.
 */
export const WorkspaceListItemSchema = WorkspaceSchema.extend({
  currentUserRole: WorkspaceRoleSchema.nullable(),
});
export type WorkspaceListItem = z.infer<typeof WorkspaceListItemSchema>;

export const WorkspaceListSchema = z.object({ items: z.array(WorkspaceListItemSchema) });

/** Parsing the id from the path: an invalid id is a 400, not a 404. */
export const WorkspaceIdParamsSchema = z.object({ id: IdSchema });
export const MemberParamsSchema = z.object({ id: IdSchema, userId: IdSchema });
export const InvitationTokenParamsSchema = z.object({ token: z.string().min(20).max(200) });
