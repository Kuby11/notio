import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './ids';

/**
 * Size limits per block type: image 20 MB, video 50 MB, everything else 20 MB.
 * The file block accepts ANY type: an empty (unknown) MIME is normalised to
 * application/octet-stream, and a video uploaded through the file block gets
 * the video limit.
 */
export const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_UPLOAD_BYTES = 20 * 1024 * 1024;

/** Upper bound for any file: Workers would reject anything larger anyway. */
export const MAX_UPLOAD_SIZE_BYTES = MAX_VIDEO_UPLOAD_BYTES;

/** The MIME stored when the browser could not detect the type. */
export const FALLBACK_MIME_TYPE = 'application/octet-stream';

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isVideoMimeType(mimeType: string): boolean {
  return mimeType.startsWith('video/');
}

export function maxUploadSizeForMime(mimeType: string): number {
  if (isImageMimeType(mimeType)) {
    return MAX_IMAGE_UPLOAD_BYTES;
  }

  if (isVideoMimeType(mimeType)) {
    return MAX_VIDEO_UPLOAD_BYTES;
  }

  return MAX_FILE_UPLOAD_BYTES;
}

/** Empty browser MIME becomes the generic binary type. */
export function normalizeUploadMimeType(mimeType: string): string {
  return mimeType.length > 0 ? mimeType : FALLBACK_MIME_TYPE;
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
