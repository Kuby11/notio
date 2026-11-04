import { isAllowedMimeType, maxUploadSizeForMime } from '@notio/contracts';

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

/** Client-side check before upload: size and MIME type. */
export function checkUploadable(file: File): MediaCheck {
  if (!isAllowedMimeType(file.type)) {
    return { ok: false, reason: 'type', mimeType: file.type, limitBytes: null };
  }

  const limit = maxUploadSizeForMime(file.type);

  if (file.size > limit) {
    return { ok: false, reason: 'size', mimeType: file.type, limitBytes: limit };
  }

  return { ok: true, reason: null, mimeType: file.type, limitBytes: null };
}

/** Size unit labels: supplied by the current locale's dictionary. */
export interface MediaSizeUnits {
  byte: string;
  kilobyte: string;
  megabyte: string;
}

const DEFAULT_SIZE_UNITS: MediaSizeUnits = { byte: 'Б', kilobyte: 'КБ', megabyte: 'МБ' };

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
