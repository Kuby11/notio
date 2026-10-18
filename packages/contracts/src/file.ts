import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './ids';

/**
 * Разрешённые типы файлов. Allowlist, а не blocklist: всё, чего здесь нет,
 * отклоняется сервисом медиа (Этап 6) ещё на границе.
 */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'video/mp4',
  'audio/mpeg',
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

export const MAX_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);
}

/** Метаданные файла в R2. Сам файл живёт в баке, ссылка выдаётся подписанная. */
export const FileMetaSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  /** Ключ объекта в R2, не публичный URL. */
  key: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
});
export type FileMeta = z.infer<typeof FileMetaSchema>;
