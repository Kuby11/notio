import type { PageVersion } from '@notio/contracts';
import type { Bindings } from '../env';
import { newId } from '@notio/contracts';
import type { Clock } from './page.service';
import { BlockRepository } from '../repositories/block.repository';
import { PageVersionRepository } from '../repositories/page-version.repository';

/**
 * Версионирование страниц: полный снапшот блоков при сохранении.
 *
 * Диффы не используем — восстановление из полного снапшота проще
 * и надёжнее, чем реконструкция из патчей.
 */
export class PageVersionService {
  constructor(
    private readonly versions: PageVersionRepository,
    private readonly blocks: BlockRepository,
    private readonly clock: Clock,
  ) {}

  /** Создаёт снапшот текущего состояния блоков страницы. */
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

/** Собирает сервис со всеми зависимостями. */
export function createPageVersionService(
  env: Bindings,
  clock: Clock = () => new Date(),
): PageVersionService {
  return new PageVersionService(new PageVersionRepository(env), new BlockRepository(env), clock);
}
