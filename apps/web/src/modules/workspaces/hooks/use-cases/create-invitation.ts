import type { Invitation } from '@notio/contracts';
import type { WorkspaceGateway } from '../../types/ports';

export class CreateInvitation {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string, role: 'editor' | 'viewer'): Promise<Invitation> {
    return this.workspaces.createInvitation(workspaceId, role);
  }
}
