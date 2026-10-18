import type { Invitation, Member, Workspace, WorkspaceRole } from '@notio/contracts';

/**
 * Порты работы с рабочими пространствами.
 *
 * Реализация — адаптер поверх gateway; use cases знают только этот интерфейс,
 * поэтому в тестах подставляется in-memory версия без сети.
 */
export interface WorkspaceListItem extends Workspace {
  /** Роль текущего пользователя: интерфейс прячет чужие действия по ней. */
  currentUserRole: WorkspaceRole | null;
}

export interface WorkspaceGateway {
  list(): Promise<WorkspaceListItem[]>;
  create(name: string): Promise<Workspace>;
  rename(workspaceId: string, name: string): Promise<Workspace>;
  archive(workspaceId: string): Promise<Workspace>;
  listMembers(workspaceId: string): Promise<Member[]>;
  changeRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<Member>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  createInvitation(workspaceId: string, role: WorkspaceRole): Promise<Invitation>;
  revokeInvitation(workspaceId: string, token: string): Promise<void>;
  acceptInvitation(token: string): Promise<Member>;
}
