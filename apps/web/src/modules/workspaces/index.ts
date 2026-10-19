import { createWorkspaceRepositoryApi } from './api/workspace.repository.api';
import { AcceptInvitation } from './hooks/use-cases/accept-invitation';
import { ArchiveWorkspace } from './hooks/use-cases/archive-workspace';
import { ChangeMemberRole } from './hooks/use-cases/change-member-role';
import { CreateInvitation } from './hooks/use-cases/create-invitation';
import { CreateWorkspace } from './hooks/use-cases/create-workspace';
import { ListMembers } from './hooks/use-cases/list-members';
import { ListWorkspaces } from './hooks/use-cases/list-workspaces';
import { RemoveMember } from './hooks/use-cases/remove-member';
import { RenameWorkspace } from './hooks/use-cases/rename-workspace';
import { RevokeInvitation } from './hooks/use-cases/revoke-invitation';
import type { TokenProvider } from '../../shared/types';
import type {
  Invitation,
  Member,
  Workspace,
  WorkspaceListItem,
  WorkspaceRole,
} from './types/ports';

export {
  useArchiveWorkspace,
  useCreateInvitation,
  useCreateWorkspace,
  useMembers,
  useRenameWorkspace,
  useWorkspaces,
} from './hooks/use-workspaces';
export { workspaceKeys } from './hooks/query-keys';
export type { WorkspaceGateway } from './types/ports';
export type { Invitation, Member, Workspace, WorkspaceListItem, WorkspaceRole };
export { capabilitiesOf, isInvitableRole, roleLabel, INVITABLE_ROLES } from './utils/rules';

/**
 * Публичный API модуля рабочих пространств.
 *
 * Фабрика собирает use cases поверх репозитория и отдаёт приложению готовый
 * набор операций. Репозиторий и DTO наружу не выходят — `api` приватно.
 */

export interface WorkspacesModule {
  list: () => Promise<WorkspaceListItem[]>;
  create: (name: string) => Promise<Workspace>;
  rename: (id: string, name: string) => Promise<Workspace>;
  archive: (id: string) => Promise<Workspace>;
  listMembers: (id: string) => Promise<Member[]>;
  changeRole: (workspaceId: string, userId: string, role: WorkspaceRole) => Promise<Member>;
  removeMember: (workspaceId: string, userId: string) => Promise<void>;
  createInvitation: (workspaceId: string, role: 'editor' | 'viewer') => Promise<Invitation>;
  revokeInvitation: (workspaceId: string, token: string) => Promise<void>;
  acceptInvitation: (token: string) => Promise<Member>;
}

export function createWorkspacesModule(deps: { accessToken: TokenProvider }): WorkspacesModule {
  const repository = createWorkspaceRepositoryApi(deps.accessToken);

  return {
    list: () => new ListWorkspaces(repository).execute(),
    create: (name) => new CreateWorkspace(repository).execute(name),
    rename: (id, name) => new RenameWorkspace(repository).execute(id, name),
    archive: (id) => new ArchiveWorkspace(repository).execute(id),
    listMembers: (id) => new ListMembers(repository).execute(id),
    changeRole: (workspaceId, userId, role) =>
      new ChangeMemberRole(repository).execute(workspaceId, userId, role),
    removeMember: (workspaceId, userId) =>
      new RemoveMember(repository).execute(workspaceId, userId),
    createInvitation: (workspaceId, role) =>
      new CreateInvitation(repository).execute(workspaceId, role),
    revokeInvitation: (workspaceId, token) =>
      new RevokeInvitation(repository).execute(workspaceId, token),
    acceptInvitation: (token) => new AcceptInvitation(repository).execute(token),
  };
}
