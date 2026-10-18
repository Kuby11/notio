import type { Page } from '@notio/contracts';
import type { PageRepository } from './ports';

/** Переименование страницы: пустое имя не отправляется, сервер всё равно проверит. */
export class RenamePage {
  constructor(private readonly pages: PageRepository) {}

  execute(id: string, workspaceId: string, title: string): Promise<Page> {
    const trimmed = title.trim();

    return this.pages.update(id, workspaceId, {
      title: trimmed.length === 0 ? 'Без названия' : trimmed,
    });
  }
}
