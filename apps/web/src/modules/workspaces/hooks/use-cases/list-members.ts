import type { Member } from '@notio/contracts';
import type { WorkspaceGateway } from '../../types/ports';

export class ListMembers {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string): Promise<Member[]> {
    return this.workspaces.listMembers(workspaceId);
  }
}
