import type { Member, WorkspaceRole } from '@notio/contracts';
import type { WorkspaceGateway } from '../../types/ports';

export class ChangeMemberRole {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string, userId: string, role: WorkspaceRole): Promise<Member> {
    return this.workspaces.changeRole(workspaceId, userId, role);
  }
}
