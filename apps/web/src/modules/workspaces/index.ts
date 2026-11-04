import { createWorkspaceRepositoryApi } from './api/workspace.api';
import type { TokenProvider } from '../../shared/types';
import type {
  Invitation,
  Member,
  Workspace,
  WorkspaceGateway,
  WorkspaceListItem,
  WorkspaceRole,
} from './types/ports';

export { useWorkspaces } from './hooks/use-workspaces';
export { workspaceKeys } from './utils/query-keys';
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
 * Public API of the workspaces module.
 *
 * The factory builds the gateway repository; only the port is exported,
 * used by the facade hooks. The adapter and DTOs stay inside the module.
 */

export type WorkspacesModule = WorkspaceGateway;

export function createWorkspacesModule(deps: { accessToken: TokenProvider }): WorkspaceGateway {
  return createWorkspaceRepositoryApi(deps.accessToken);
}
