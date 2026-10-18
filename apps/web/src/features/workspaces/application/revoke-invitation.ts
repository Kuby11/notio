import type { WorkspaceGateway } from './ports';

export class RevokeInvitation {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string, token: string): Promise<void> {
    return this.workspaces.revokeInvitation(workspaceId, token);
  }
}
