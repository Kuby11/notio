import { isAllowedMimeType, maxUploadSizeForMime } from '@notio/contracts';

/** Куда грузим: изображение, видео или произвольный файл. */
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
  /** Причина отказа: текст переводит UI, а не доменная проверка. */
  reason: 'type' | 'size' | null;
  /** MIME-тип файла: нужен для сообщения о неподдерживаемом типе. */
  mimeType: string | null;
  /** Лимит в байтах, если файл его превысил. */
  limitBytes: number | null;
}

/** Клиентская проверка до отправки: размер и MIME-тип. */
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

/** Подписи единиц размера: приходят из словаря текущей локали. */
export interface MediaSizeUnits {
  byte: string;
  kilobyte: string;
  megabyte: string;
}

const DEFAULT_SIZE_UNITS: MediaSizeUnits = { byte: 'Б', kilobyte: 'КБ', megabyte: 'МБ' };

/** Размер в человекочитаемом виде: КБ/МБ. */
export function formatBytes(bytes: number, units: MediaSizeUnits = DEFAULT_SIZE_UNITS): string {
  if (bytes >= 1024 * 1024) {
    // Одна цифра после точки, но без хвостового «.0»: лимиты круглые.
    return `${Number((bytes / (1024 * 1024)).toFixed(1))} ${units.megabyte}`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} ${units.kilobyte}`;
  }

  return `${bytes} ${units.byte}`;
}

/** Публичный URL файла в gateway по id объекта R2. */
export function mediaFileUrl(fileId: string, gatewayUrl: string, download = false): string {
  return `${gatewayUrl}/api/media/files/${fileId}${download ? '?download=1' : ''}`;
}
