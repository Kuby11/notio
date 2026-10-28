import type { PageVersion } from '@notio/contracts';
import type { Bindings } from '../env';
import { newId } from '@notio/contracts';
import type { Clock } from './page.service';
import { BlockRepository } from '../repositories/block.repository';
import { PageVersionRepository } from '../repositories/page-version.repository';

/**
 * Page versioning: a full block snapshot on save.
 *
 * We do not use diffs — restoring from a full snapshot is simpler and more
 * reliable than reconstructing from patches.
 */
export class PageVersionService {
  constructor(
    private readonly versions: PageVersionRepository,
    private readonly blocks: BlockRepository,
    private readonly clock: Clock,
  ) {}

  /** Creates a snapshot of the page's current block state. */
  async createSnapshot(pageId: string, actorId: string): Promise<PageVersion> {
    const blocks = await this.blocks.listByPage(pageId);

    const version = await this.versions.create({
      id: newId(),
      pageId,
      content: blocks.map((block) => block.content),
      createdBy: actorId,
      createdAt: this.clock().toISOString(),
    });

    await this.versions.prune(pageId, 50);

    return version;
  }

  async listVersions(pageId: string): Promise<PageVersion[]> {
    return this.versions.listByPage(pageId);
  }

  async getVersion(id: string): Promise<PageVersion | null> {
    return this.versions.findById(id);
  }
}

export function createPageVersionService(
  env: Bindings,
  clock: Clock = () => new Date(),
): PageVersionService {
  return new PageVersionService(new PageVersionRepository(env), new BlockRepository(env), clock);
}
