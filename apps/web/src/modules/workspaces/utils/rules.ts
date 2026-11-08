/**
 * Client-side workspace rules.
 *
 * The same constraints as on the server: the UI must not offer
 * an action the service would reject anyway.
 */
import type { WorkspaceRole } from '@notio/contracts';

/** Roles that can be granted by invitation: owner is assigned manually only. */
export const INVITABLE_ROLES = ['editor', 'viewer'] as const satisfies readonly WorkspaceRole[];

const ROLE_LABELS: Readonly<Record<WorkspaceRole, string>> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
};

/** Actions available to the current role in the UI. */
export interface RoleCapabilities {
  canRename: boolean;
  canArchive: boolean;
  canManageMembers: boolean;
  canInvite: boolean;
}

export function capabilitiesOf(role: WorkspaceRole | null): RoleCapabilities {
  return {
    canRename: role === 'owner',
    canArchive: role === 'owner',
    canManageMembers: role === 'owner',
    canInvite: role === 'owner',
  };
}

export function roleLabel(role: WorkspaceRole): string {
  return ROLE_LABELS[role];
}

export function isInvitableRole(role: string): role is (typeof INVITABLE_ROLES)[number] {
  return INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number]);
}

/**
 * Trims whitespace and rejects an empty name.
 *
 * The service rejects an empty name too, but the client check avoids a
 * round trip just to be refused.
 */
export function assertWorkspaceName(name: string): string {
  const trimmed = name.trim();

  if (trimmed.length === 0) {
    throw new Error('Name cannot be empty');
  }

  return trimmed;
}
