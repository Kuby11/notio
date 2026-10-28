import { createMediaRepositoryApi } from './api/media.repository.api';
import type { TokenProvider } from '../../shared/types';
import type { MediaRepository } from './types/ports';

export { useMedia } from './hooks/use-media';
export { checkUploadable, formatBytes, mediaFileUrl, mediaKindOfMime } from './utils/media';
export type { MediaKind } from './utils/media';
export type { MediaRepository } from './types/ports';

/**
 * Публичный API модуля медиа.
 *
 * Наружу выходят только фабрика, facade-хук и утилиты. Адаптер поверх
 * gateway остаётся внутренним: контейнер получает лишь порт MediaRepository.
 */

export type MediaModule = MediaRepository;

export function createMediaModule(deps: { accessToken: TokenProvider }): MediaRepository {
  return createMediaRepositoryApi(deps.accessToken);
}
