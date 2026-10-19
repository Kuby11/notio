import type { Member } from '@notio/contracts';
import type { WorkspaceGateway } from '../../types/ports';

export class AcceptInvitation {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(token: string): Promise<Member> {
    return this.workspaces.acceptInvitation(token);
  }
}
