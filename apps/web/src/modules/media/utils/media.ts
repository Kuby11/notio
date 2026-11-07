import { maxUploadSizeForMime } from '@notio/contracts';

/** What is uploaded: image, video or an arbitrary file. */
export type MediaKind = 'image' | 'video' | 'file';

export function mediaKindOfMime(mimeType: string): MediaKind {
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  if (mimeType.startsWith('video/')) {
    return 'video';
  }

  return 'file';
}

export interface MediaCheck {
  ok: boolean;
  /** Rejection reason: the UI translates it, not the domain check. */
  reason: 'type' | 'size' | null;
  /** File MIME type: used for the unsupported-type message. */
  mimeType: string | null;
  /** The byte limit the file exceeded. */
  limitBytes: number | null;
}

/** Client-side check before upload: type against the block kind, then size.
 *
 * The image block needs an image, the video block a video; the file block
 * accepts ANY type — an unknown browser MIME is normalised to the generic
 * binary type, and a video uploaded through it still gets the video limit.
 */
export function checkUploadable(file: File, kind: MediaKind): MediaCheck {
  const mimeType = file.type;

  if (kind === 'image' && !mimeType.startsWith('image/')) {
    return { ok: false, reason: 'type', mimeType, limitBytes: null };
  }

  if (kind === 'video' && !mimeType.startsWith('video/')) {
    return { ok: false, reason: 'type', mimeType, limitBytes: null };
  }

  const limit = maxUploadSizeForMime(mimeType);

  if (file.size > limit) {
    return { ok: false, reason: 'size', mimeType, limitBytes: limit };
  }

  return { ok: true, reason: null, mimeType, limitBytes: null };
}

/** Size unit labels: supplied by the current locale's dictionary. */
export interface MediaSizeUnits {
  byte: string;
  kilobyte: string;
  megabyte: string;
}

const DEFAULT_SIZE_UNITS: MediaSizeUnits = { byte: 'B', kilobyte: 'KB', megabyte: 'MB' };

/** Human-readable size: KB/MB. */
export function formatBytes(bytes: number, units: MediaSizeUnits = DEFAULT_SIZE_UNITS): string {
  if (bytes >= 1024 * 1024) {
    // One decimal place, but no trailing ".0": the limits are round numbers.
    return `${Number((bytes / (1024 * 1024)).toFixed(1))} ${units.megabyte}`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} ${units.kilobyte}`;
  }

  return `${bytes} ${units.byte}`;
}

/** Public gateway URL for the file, from the R2 object id. */
export function mediaFileUrl(fileId: string, gatewayUrl: string, download = false): string {
  return `${gatewayUrl}/api/media/files/${fileId}${download ? '?download=1' : ''}`;
}
