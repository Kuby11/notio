import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './ids';

/**
 * Allowed file types. An allowlist, not a blocklist: anything missing here
 * is rejected by the media service at the boundary.
 */
export const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/zip',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/wav',
] as const;

export type AllowedUploadMimeType = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

/** Size limits per block type: image 20 MB, video 50 MB, everything else 20 MB. */
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Upper bound for any file: Workers would reject anything larger anyway. */
export const MAX_UPLOAD_SIZE_BYTES = MAX_VIDEO_UPLOAD_BYTES;

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function maxUploadSizeForMime(mimeType: string): number {
  if (mimeType.startsWith('image/')) {
    return MAX_IMAGE_UPLOAD_BYTES;
  }

  if (mimeType.startsWith('video/')) {
    return MAX_VIDEO_UPLOAD_BYTES;
  }

  return MAX_FILE_UPLOAD_BYTES;
}

export function formatUploadLimit(mimeType: string): string {
  const mb = Math.round(maxUploadSizeForMime(mimeType) / (1024 * 1024));

  return `${mb} МБ`;
}

/** File metadata in R2. The file itself lives in the bucket; access goes through the gateway. */
export const FileMetaSchema = z.object({
  id: IdSchema,
  workspaceId: IdSchema,
  /** R2 object key, not a public URL. */
  key: z.string().min(1).max(512),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: IsoDateTimeSchema,
});
export type FileMeta = z.infer<typeof FileMetaSchema>;
