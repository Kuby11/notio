import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from '@notio/contracts';
import { checkUploadable, formatBytes, mediaFileUrl, mediaKindOfMime } from './media';

describe('checkUploadable', () => {
  it('пропускает файл в рамках лимита', () => {
    const file = new File([new Uint8Array([1])], 'pic.png', { type: 'image/png' });

    expect(checkUploadable(file)).toEqual({
      ok: true,
      reason: null,
      mimeType: 'image/png',
      limitBytes: null,
    });
  });

  it('сообщает о превышении лимита изображения (20 МБ)', () => {
    const file = new File([new Uint8Array(1)], 'huge.png', { type: 'image/png' });

    Object.defineProperty(file, 'size', { value: MAX_IMAGE_UPLOAD_BYTES + 1 });

    const check = checkUploadable(file);

    expect(check.ok).toBe(false);
    expect(check.reason).toBe('size');
    expect(check.limitBytes).toBe(MAX_IMAGE_UPLOAD_BYTES);
  });

  it('видео пропускает до 50 МБ', () => {
    const file = new File([new Uint8Array(1)], 'clip.mp4', { type: 'video/mp4' });

    Object.defineProperty(file, 'size', { value: MAX_VIDEO_UPLOAD_BYTES });

    expect(checkUploadable(file).ok).toBe(true);
  });

  it('отклоняет неразрешённый тип', () => {
    const file = new File([new Uint8Array([1])], 'boot.exe', {
      type: 'application/x-msdownload',
    });

    const check = checkUploadable(file);

    expect(check.ok).toBe(false);
    expect(check.reason).toBe('type');
    expect(check.mimeType).toBe('application/x-msdownload');
  });
});

describe('mediaKindOfMime / formatBytes / mediaFileUrl', () => {
  it('определяет тип блока по MIME', () => {
    expect(mediaKindOfMime('image/png')).toBe('image');
    expect(mediaKindOfMime('video/mp4')).toBe('video');
    expect(mediaKindOfMime('application/pdf')).toBe('file');
  });

  it('форматирует размеры', () => {
    expect(formatBytes(900)).toBe('900 Б');
    expect(formatBytes(2048)).toBe('2 КБ');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 МБ');
  });

  it('берёт подписи единиц из локали', () => {
    const units = { byte: 'B', kilobyte: 'KB', megabyte: 'MB' };

    expect(formatBytes(900, units)).toBe('900 B');
    expect(formatBytes(2048, units)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024, units)).toBe('5 MB');
  });

  it('строит URL файла в gateway', () => {
    expect(mediaFileUrl('abc', 'http://gateway:8080')).toBe(
      'http://gateway:8080/api/media/files/abc',
    );
    expect(mediaFileUrl('abc', 'http://gateway:8080', true)).toBe(
      'http://gateway:8080/api/media/files/abc?download=1',
    );
  });
});
