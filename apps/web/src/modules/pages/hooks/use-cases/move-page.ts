import type { MovePageInput, Page } from '@notio/contracts';
import type { PageNode } from '../../utils/page';
import { canMove } from '../../utils/page';
import type { PageRepository } from '../../types/ports';

/**
 * Перемещение страницы.
 *
 * Цикл проверяется на клиенте до запроса: иначе пользователь ждал бы
 * сетевой ответ, чтобы узнать, что действие запрещено. Сервер всё равно
 * проверяет повторно — клиент не источник истины.
 */
export class MovePage {
  constructor(private readonly pages: PageRepository) {}

  async execute(input: {
    pageId: string;
    workspaceId: string;
    newParentId: string | null;
    afterPageId?: string;
    tree: readonly PageNode[];
  }): Promise<Page> {
    if (!canMove(input.tree, input.pageId, input.newParentId)) {
      throw new Error('Нельзя переместить страницу внутрь собственного потомка');
    }

    const moveInput: MovePageInput = {
      parentId: input.newParentId,
      afterPageId: input.afterPageId,
    };

    return this.pages.move(input.pageId, input.workspaceId, moveInput);
  }
}
