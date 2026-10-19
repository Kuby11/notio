import type { Page } from '@notio/contracts';
import type { PageRepository } from '../../types/ports';

/** Возврат страницы из корзины. */
export class RestorePage {
  constructor(private readonly pages: PageRepository) {}

  execute(id: string, workspaceId: string): Promise<Page> {
    return this.pages.update(id, workspaceId, { isTrashed: false });
  }
}
