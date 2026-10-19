import type { WorkspaceGateway } from '../../types/ports';

export class RevokeInvitation {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string, token: string): Promise<void> {
    return this.workspaces.revokeInvitation(workspaceId, token);
  }
}
