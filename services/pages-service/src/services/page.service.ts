import type {
  CreatePageInput,
  MovePageInput,
  Page,
  PageAllQuery,
  PageFavoritesQuery,
  PageListQuery,
  PageSearchQuery,
  PageTrashQuery,
  UpdatePageInput,
} from '@notio/contracts';
import { IdSchema, newId } from '@notio/contracts';
import { generateKeyBetween } from 'fractional-indexing';
import type { Bindings } from '../env';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import { BlockRepository } from '../repositories/block.repository';
import { PageRepository } from '../repositories/page.repository';

/** The time source is injected so tests do not depend on the system clock. */
export type Clock = () => Date;

export interface PageListResult {
  items: Page[];
  nextCursor: string | null;
}

/**
 * Scenarios for working with pages.
 *
 * This layer knows nothing about HTTP: no Request, no Response, no status
 * codes — only domain types and typed errors.
 */
export class PageService {
  constructor(
    private readonly pages: PageRepository,
    private readonly blocks: BlockRepository,
    private readonly clock: Clock,
  ) {}

  private now(): string {
    return this.clock().toISOString();
  }

  async createPage(input: CreatePageInput, actorId: string): Promise<Page> {
    await this.assertParentIsUsable(input.workspaceId, input.parentId);

    const bounds = await this.pages.findPositionBounds(
      input.workspaceId,
      input.parentId,
      input.afterPageId,
    );
    const now = this.now();

    return this.pages.create({
      id: newId(),
      workspaceId: input.workspaceId,
      parentId: input.parentId,
      title: input.title,
      icon: input.icon ?? null,
      coverFileId: null,
      position: generateKeyBetween(bounds.before, bounds.after),
      isFavorite: false,
      isTrashed: false,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Page duplicate: a copy of the pages row with the same parent and position
   * right after the original, plus a copy of the page's blocks. Nested child
   * pages are not copied (deep duplication is a separate task).
   */
  async duplicatePage(id: string, actorId: string): Promise<Page> {
    const source = await this.pages.findById(id);

    if (!source) {
      throw new NotFoundError('Page not found');
    }

    if (source.isTrashed) {
      throw new ConflictError('A page in the trash cannot be duplicated');
    }

    const bounds = await this.pages.findPositionBounds(source.workspaceId, source.parentId, id);
    const now = this.now();

    const copy = await this.pages.create({
      id: newId(),
      workspaceId: source.workspaceId,
      parentId: source.parentId,
      title: source.title,
      icon: source.icon ?? null,
      coverFileId: source.coverFileId ?? null,
      position: generateKeyBetween(bounds.before, bounds.after),
      isFavorite: false,
      isTrashed: false,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });

    const sourceBlocks = await this.blocks.listByPage(id);
    let previousPosition: string | null = null;

    for (const block of sourceBlocks) {
      const position = generateKeyBetween(previousPosition, null);
      await this.blocks.create({
        id: newId(),
        pageId: copy.id,
        type: block.type,
        position,
        content: block.content,
        // The copy is a fresh edit by whoever duplicated the page.
        updatedBy: actorId,
        createdAt: now,
        updatedAt: now,
      });
      previousPosition = position;
    }

    return copy;
  }

  async listChildren(query: PageListQuery): Promise<PageListResult> {
    // Request one extra row: the extra row becomes the cursor.
    const items = await this.pages.listChildren({
      workspaceId: query.workspaceId,
      parentId: query.parentId,
      includeTrashed: query.includeTrashed,
      afterPosition: query.cursor,
      limit: query.limit + 1,
    });

    const hasMore = items.length > query.limit;
    const page = hasMore ? items.slice(0, query.limit) : items;
    const last = page.at(-1);

    return { items: page, nextCursor: hasMore && last ? last.position : null };
  }

  /** Favorites are not paginated: a short list of links, not a tree. */
  async listFavorites(query: PageFavoritesQuery): Promise<PageListResult> {
    const items = await this.pages.listFavorites(query.workspaceId);

    return { items, nextCursor: null };
  }

  /** The trash is flat too: a page can be restored regardless of its parent. */
  async listTrashed(query: PageTrashQuery): Promise<PageListResult> {
    const items = await this.pages.listTrashed(query.workspaceId);

    return { items, nextCursor: null };
  }

  /** Search is flat like favorites: a title match can sit at any depth. */
  async searchPages(query: PageSearchQuery): Promise<PageListResult> {
    const items = await this.pages.search(query.workspaceId, query.q);

    return { items, nextCursor: null };
  }

  /** The whole workspace in one flat list: the library view filters and nests it. */
  async listAll(query: PageAllQuery): Promise<PageListResult> {
    const items = await this.pages.listAll(query.workspaceId);

    return { items, nextCursor: null };
  }

  async getPage(id: string, workspaceId?: string): Promise<Page> {
    const page = await this.pages.findById(id);

    if (!page) {
      throw new NotFoundError('Page not found');
    }

    if (workspaceId !== undefined && page.workspaceId !== workspaceId) {
      // A foreign workspace answers exactly like a missing page:
      // otherwise foreign data could be discovered by brute force through codes.
      throw new NotFoundError('Page not found');
    }

    return page;
  }

  async updatePage(id: string, workspaceId: string, patch: UpdatePageInput): Promise<Page> {
    await this.getPage(id, workspaceId);

    const updated = await this.pages.updateById(id, patch, this.now());

    if (!updated) {
      throw new NotFoundError('Page not found');
    }

    return updated;
  }

  /**
   * Moving a page to another parent with a cycle check.
   *
   * A "page into its own descendant" cycle would break the tree: the page
   * would become unreachable. The chain of ancestors is checked, not only the
   * immediate parent.
   */
  async movePage(id: string, workspaceId: string, input: MovePageInput): Promise<Page> {
    const page = await this.getPage(id, workspaceId);

    if (page.isTrashed) {
      throw new ConflictError('A page in the trash cannot be moved');
    }

    await this.assertParentIsUsable(workspaceId, input.parentId);
    await this.assertNoCycle(workspaceId, id, input.parentId);

    const bounds = await this.pages.findPositionBounds(
      workspaceId,
      input.parentId,
      input.afterPageId,
    );
    const updated = await this.pages.moveById(
      id,
      input.parentId,
      generateKeyBetween(bounds.before, bounds.after),
      this.now(),
    );

    if (!updated) {
      throw new NotFoundError('Page not found');
    }

    return updated;
  }

  /** Checks that the new parent is neither the page itself nor its descendant. */
  private async assertNoCycle(
    workspaceId: string,
    pageId: string,
    newParentId: string | null,
  ): Promise<void> {
    if (newParentId === null) {
      return;
    }

    if (newParentId === pageId) {
      throw new ConflictError('A page cannot be moved inside itself');
    }

    let current: string | null = newParentId;
    const visited = new Set<string>();

    while (current !== null) {
      if (visited.has(current)) {
        // The cycle already exists in the data — do not make it worse.
        throw new ConflictError('A cycle in the page tree was detected');
      }

      visited.add(current);

      if (current === pageId) {
        throw new ConflictError('A page cannot be moved inside its own descendant');
      }

      const parent = await this.pages.findById(current);

      if (parent === null || parent.workspaceId !== workspaceId) {
        return;
      }

      current = parent.parentId;
    }
  }

  /** The parent must exist, belong to the same workspace and not be in the trash. */
  private async assertParentIsUsable(workspaceId: string, parentId: string | null): Promise<void> {
    if (parentId === null) {
      return;
    }

    const parent = await this.pages.findById(parentId);

    if (!parent) {
      throw new NotFoundError('Parent page not found');
    }

    if (parent.workspaceId !== workspaceId) {
      throw new ForbiddenError('The parent page belongs to another workspace');
    }

    if (parent.isTrashed) {
      throw new ConflictError('A page cannot be created inside a page in the trash');
    }
  }
}

export function createPageService(env: Bindings, clock: Clock = () => new Date()): PageService {
  return new PageService(new PageRepository(env), new BlockRepository(env), clock);
}

/** The author id comes from the gateway; without it the service does not create the page. */
export function requireActorId(actorId: string | undefined | null): string {
  if (!actorId) {
    // Identity signing arrives together with auth-service.
    // For now this is a deliberate "fail closed": no context — no write.
    throw new ForbiddenError('Could not identify the user from the request context');
  }

  return IdSchema.parse(actorId);
}
