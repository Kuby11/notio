import type { Page } from '@notio/contracts';
import type { PageRepository } from './ports';

/** Загрузка детей страницы: серверный список, без мутаций. */
export class ListChildren {
  constructor(private readonly pages: PageRepository) {}

  execute(workspaceId: string, parentId: string | null, includeTrashed = false): Promise<Page[]> {
    return this.pages.listChildren(workspaceId, parentId, includeTrashed);
  }
}
