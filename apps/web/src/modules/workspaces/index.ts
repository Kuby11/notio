import { createWorkspaceRepositoryApi } from './api/workspace.repository.api';
import type { TokenProvider } from '../../shared/types';
import type {
  Invitation,
  Member,
  Workspace,
  WorkspaceGateway,
  WorkspaceListItem,
  WorkspaceRole,
} from './types/ports';

export {
  useAcceptInvitation,
  useArchiveWorkspace,
  useChangeMemberRole,
  useCreateInvitation,
  useCreateWorkspace,
  useMembers,
  useRemoveMember,
  useRenameWorkspace,
  useRevokeInvitation,
  useWorkspaces,
} from './hooks/use-workspaces';
export { workspaceKeys } from './hooks/query-keys';
export type { WorkspaceGateway } from './types/ports';
export type { Invitation, Member, Workspace, WorkspaceListItem, WorkspaceRole };
export {
  assertWorkspaceName,
  capabilitiesOf,
  isInvitableRole,
  roleLabel,
  INVITABLE_ROLES,
} from './utils/rules';

/**
 * Публичный API модуля рабочих пространств.
 *
 * Фабрика собирает репозиторий поверх gateway; наружу отдаётся только порт,
 * которым пользуются facade-хуки. Адаптер и DTO остаются внутри модуля.
 */

export type WorkspacesModule = WorkspaceGateway;

export function createWorkspacesModule(deps: { accessToken: TokenProvider }): WorkspaceGateway {
  return createWorkspaceRepositoryApi(deps.accessToken);
}
