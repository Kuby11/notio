import type { Page } from '@notio/contracts';
import type { PageRepository } from './ports';

/** Переключение избранного: сервер хранит состояние, клиент только просит. */
export class ToggleFavorite {
  constructor(private readonly pages: PageRepository) {}

  execute(id: string, workspaceId: string, isFavorite: boolean): Promise<Page> {
    return this.pages.update(id, workspaceId, { isFavorite });
  }
}
