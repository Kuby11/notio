import type {
  CreatePageInput,
  MovePageInput,
  Page,
  PageListQuery,
  PageListResultResponse,
  UpdatePageInput,
} from '@notio/contracts';

/**
 * Порт страниц.
 *
 * Реализация — адаптер поверх gateway; facade-хуки знают только этот
 * интерфейс, поэтому в тестах подставляется in-memory версия без сети.
 */
export interface PageRepository {
  listChildren(
    workspaceId: string,
    parentId: string | null,
    includeTrashed: boolean,
  ): Promise<Page[]>;
  create(input: CreatePageInput): Promise<Page>;
  getPage(id: string, workspaceId: string): Promise<Page>;
  update(id: string, workspaceId: string, patch: UpdatePageInput): Promise<Page>;
  move(id: string, workspaceId: string, input: MovePageInput): Promise<Page>;
}

/** Входная форма создания страницы: минимум полей для UI. */
export type CreatePageFormInput = {
  workspaceId: string;
  parentId?: string | null;
  title?: string;
  icon?: string;
};

export type { Page, PageListQuery, PageListResultResponse };
