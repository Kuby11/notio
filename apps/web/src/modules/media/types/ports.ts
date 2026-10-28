import type { FileMeta } from '@notio/contracts';

/**
 * Порт репозитория медиа.
 *
 * Реализация — адаптер поверх gateway; facade-хук знает только этот
 * интерфейс, поэтому в тестах подставляется in-memory версия без сети.
 */
export interface MediaRepository {
  /** Загружает файл в media-service (R2) и возвращает его метаданные. */
  upload(input: { workspaceId: string; file: File }): Promise<FileMeta>;
}

export type MediaModule = MediaRepository;
