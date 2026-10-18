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
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

/** Действия, которые роль разрешает: матрица прав живёт в одном месте. */
export const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, readonly string[]>> = {
  owner: ['workspace:read', 'workspace:write', 'member:manage', 'page:write', 'page:read'],
  editor: ['workspace:read', 'page:write', 'page:read'],
  viewer: ['workspace:read', 'page:read'],
};

export function roleCan(role: WorkspaceRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
