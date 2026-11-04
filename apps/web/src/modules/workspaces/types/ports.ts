import type {
  Invitation,
  Member,
  Workspace,
  WorkspaceListItem,
  WorkspaceRole,
} from '@notio/contracts';

/**
 * Ports for workspaces.
 *
 * Implemented by the gateway adapter; the facade hooks know only this
 * interface, so tests substitute an in-memory version with no network.
 */
export interface WorkspaceGateway {
  list(): Promise<WorkspaceListItem[]>;
  create(name: string): Promise<Workspace>;
  rename(workspaceId: string, name: string): Promise<Workspace>;
  archive(workspaceId: string): Promise<Workspace>;
  restore(workspaceId: string): Promise<Workspace>;
  listMembers(workspaceId: string): Promise<Member[]>;
  changeRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<Member>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  createInvitation(workspaceId: string, role: 'editor' | 'viewer'): Promise<Invitation>;
  revokeInvitation(workspaceId: string, token: string): Promise<void>;
  acceptInvitation(token: string): Promise<Member>;
}

export type { Workspace, WorkspaceListItem, WorkspaceRole, Member, Invitation };
