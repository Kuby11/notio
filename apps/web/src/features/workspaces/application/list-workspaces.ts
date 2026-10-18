import type { WorkspaceListItem } from '@notio/contracts';
import type { WorkspaceGateway } from './ports';

export class ListWorkspaces {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(): Promise<WorkspaceListItem[]> {
    return this.workspaces.list();
  }
}
