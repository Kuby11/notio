import type { Page } from '@notio/contracts';
import type { PageRepository } from '../../types/ports';

/** Мягкое удаление: страница уходит в корзину, но не стирается. */
export class TrashPage {
  constructor(private readonly pages: PageRepository) {}

  execute(id: string, workspaceId: string): Promise<Page> {
    return this.pages.update(id, workspaceId, { isTrashed: true });
  }
}
