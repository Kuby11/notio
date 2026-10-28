import type {
  CreatePageInput,
  MovePageInput,
  Page,
  PageListQuery,
  PageListResultResponse,
  UpdatePageInput,
} from '@notio/contracts';

/**
 * Page port.
 *
 * Implementation is an adapter over the gateway; facade hooks know only this
 * interface, so in tests an in-memory version without network can be substituted.
 */
export interface PageRepository {
  listChildren(
    workspaceId: string,
    parentId: string | null,
    includeTrashed: boolean,
  ): Promise<Page[]>;
  listFavorites(workspaceId: string): Promise<Page[]>;
  listTrashed(workspaceId: string): Promise<Page[]>;
  /** Every page of the workspace in one flat list (the library view nests it). */
  listAll(workspaceId: string): Promise<Page[]>;
  search(workspaceId: string, query: string): Promise<Page[]>;
  create(input: CreatePageInput): Promise<Page>;
  getPage(id: string, workspaceId: string): Promise<Page>;
  update(id: string, workspaceId: string, patch: UpdatePageInput): Promise<Page>;
  duplicate(id: string, workspaceId: string): Promise<Page>;
  move(id: string, workspaceId: string, input: MovePageInput): Promise<Page>;
}

/** Input form for creating a page: minimum fields for the UI. */
export type CreatePageFormInput = {
  workspaceId: string;
  parentId?: string | null;
  title?: string;
  icon?: string;
};

export type { Page, PageListQuery, PageListResultResponse };
