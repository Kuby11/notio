import type { Workspace } from '@notio/contracts';
import type { WorkspaceGateway } from '../../types/ports';

export class RenameWorkspace {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(workspaceId: string, name: string): Promise<Workspace> {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new Error('Название не может быть пустым');
    }

    return this.workspaces.rename(workspaceId, trimmed);
  }
}
