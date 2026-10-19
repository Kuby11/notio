import type { Workspace } from '@notio/contracts';
import type { WorkspaceGateway } from '../../types/ports';

export class CreateWorkspace {
  constructor(private readonly workspaces: WorkspaceGateway) {}

  execute(name: string): Promise<Workspace> {
    const trimmed = name.trim();

    if (trimmed.length === 0) {
      throw new Error('Название не может быть пустым');
    }

    return this.workspaces.create(trimmed);
  }
}
