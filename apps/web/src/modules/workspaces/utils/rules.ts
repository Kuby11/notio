/**
 * Правила рабочих пространств на клиенте.
 *
 * Те же ограничения, что и на сервере: интерфейс не должен предлагать
 * действие, которое сервис всё равно отклонит.
 */
import type { WorkspaceRole } from '@notio/contracts';

/** Роли, которые можно выдать по приглашению: owner выдаётся только вручную. */
export const INVITABLE_ROLES = ['editor', 'viewer'] as const satisfies readonly WorkspaceRole[];

const ROLE_LABELS: Readonly<Record<WorkspaceRole, string>> = {
  owner: 'Владелец',
  editor: 'Редактор',
  viewer: 'Наблюдатель',
};

/** Действия, доступные текущей роли в интерфейсе. */
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
