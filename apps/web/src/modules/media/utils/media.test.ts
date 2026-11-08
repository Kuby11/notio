import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES } from '@notio/contracts';
import { checkUploadable, formatBytes, mediaFileUrl, mediaKindOfMime } from './media';

describe('checkUploadable', () => {
  it('passes a file within the limit', () => {
    const file = new File([new Uint8Array([1])], 'pic.png', { type: 'image/png' });

    expect(checkUploadable(file, 'image')).toEqual({
      ok: true,
      reason: null,
      mimeType: 'image/png',
      limitBytes: null,
    });
  });

  it('reports an image over the limit (20 MB)', () => {
    const file = new File([new Uint8Array(1)], 'huge.png', { type: 'image/png' });

    Object.defineProperty(file, 'size', { value: MAX_IMAGE_UPLOAD_BYTES + 1 });

    const check = checkUploadable(file, 'image');

    expect(check.ok).toBe(false);
    expect(check.reason).toBe('size');
    expect(check.limitBytes).toBe(MAX_IMAGE_UPLOAD_BYTES);
  });

  it('allows video up to 50 MB', () => {
    const file = new File([new Uint8Array(1)], 'clip.mp4', { type: 'video/mp4' });

    Object.defineProperty(file, 'size', { value: MAX_VIDEO_UPLOAD_BYTES });

    expect(checkUploadable(file, 'video').ok).toBe(true);
  });

  it('rejects a disallowed type', () => {
    const file = new File([new Uint8Array([1])], 'boot.exe', {
      type: 'application/x-msdownload',
    });

    const check = checkUploadable(file, 'image');

    expect(check.ok).toBe(false);
    expect(check.reason).toBe('type');
    expect(check.mimeType).toBe('application/x-msdownload');
  });
});

describe('mediaKindOfMime / formatBytes / mediaFileUrl', () => {
  it('determines the block type from MIME', () => {
    expect(mediaKindOfMime('image/png')).toBe('image');
    expect(mediaKindOfMime('video/mp4')).toBe('video');
    expect(mediaKindOfMime('application/pdf')).toBe('file');
  });

  it('formats sizes', () => {
    expect(formatBytes(900)).toBe('900 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('takes unit labels from the locale', () => {
    const units = { byte: 'B', kilobyte: 'KB', megabyte: 'MB' };

    expect(formatBytes(900, units)).toBe('900 B');
    expect(formatBytes(2048, units)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024, units)).toBe('5 MB');
  });

  it('builds the file URL in the gateway', () => {
    expect(mediaFileUrl('abc', 'http://gateway:8080')).toBe(
      'http://gateway:8080/api/media/files/abc',
    );
    expect(mediaFileUrl('abc', 'http://gateway:8080', true)).toBe(
      'http://gateway:8080/api/media/files/abc?download=1',
    );
  });
});
