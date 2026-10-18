// Page возвращается репозиторием, здесь он не упоминается явно.
import type { PageRepository } from './ports';

/** Создание страницы: сервер сам вычисляет позицию, клиент передаёт только контекст. */
export class CreatePage {
  constructor(private readonly pages: PageRepository) {}

  execute(input: { workspaceId: string; parentId?: string | null; title?: string; icon?: string }) {
    return this.pages.create({
      workspaceId: input.workspaceId,
      parentId: input.parentId ?? null,
      title: input.title ?? '',
      icon: input.icon,
    });
  }
}
