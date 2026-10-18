import type { WorkspaceGateway } from './ports';

export class RemoveMember {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string, userId: string): Promise<void> {
    return this.workspaces.removeMember(workspaceId, userId);
  }
}
