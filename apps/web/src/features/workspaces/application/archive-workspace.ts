import type { Workspace } from '@notio/contracts';
import type { WorkspaceGateway } from './ports';

export class ArchiveWorkspace {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string): Promise<Workspace> {
    return this.workspaces.archive(workspaceId);
  }
}
