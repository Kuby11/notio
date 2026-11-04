import { createMediaRepositoryApi } from './api/media.api';
import type { TokenProvider } from '../../shared/types';
import type { MediaRepository } from './types/ports';

export { useMedia } from './hooks/use-media';
export { checkUploadable, formatBytes, mediaFileUrl, mediaKindOfMime } from './utils/media';
export type { MediaKind } from './utils/media';
export type { MediaRepository } from './types/ports';

/**
 * Public API of the media module.
 *
 * Only the factory, facade hook and utilities are exported. The adapter over
 * the gateway stays internal: the container receives only the MediaRepository port.
 */

export type MediaModule = MediaRepository;

export function createMediaModule(deps: { accessToken: TokenProvider }): MediaRepository {
  return createMediaRepositoryApi(deps.accessToken);
}
