import { describe, expect, it } from 'vitest';
import {
  FALLBACK_MIME_TYPE,
  FileMetaSchema,
  MAX_FILE_UPLOAD_BYTES,
  MAX_IMAGE_UPLOAD_BYTES,
  MAX_UPLOAD_SIZE_BYTES,
  MAX_VIDEO_UPLOAD_BYTES,
  formatUploadLimit,
  maxUploadSizeForMime,
  normalizeUploadMimeType,
} from './file';
import { newId } from './ids';

describe('Upload limits', () => {
  it('normalises an unknown browser MIME to the generic binary type', () => {
    expect(normalizeUploadMimeType('')).toBe(FALLBACK_MIME_TYPE);
    expect(normalizeUploadMimeType('application/pdf')).toBe('application/pdf');
  });

  it('picks the limit by media family', () => {
    expect(maxUploadSizeForMime('image/png')).toBe(MAX_IMAGE_UPLOAD_BYTES);
    expect(maxUploadSizeForMime('video/mp4')).toBe(MAX_VIDEO_UPLOAD_BYTES);
    expect(maxUploadSizeForMime('application/pdf')).toBe(MAX_FILE_UPLOAD_BYTES);
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(MAX_VIDEO_UPLOAD_BYTES);
  });

  it('formats the limit in whole megabytes', () => {
    expect(formatUploadLimit('image/png')).toBe('20 MB');
    expect(formatUploadLimit('video/webm')).toBe('50 MB');
    expect(formatUploadLimit('text/plain')).toBe('20 MB');
  });
});

describe('FileMetaSchema', () => {
  const meta = {
    id: newId(),
    workspaceId: newId(),
    key: 'files/abc',
    fileName: 'photo.png',
    mimeType: 'image/png',
    sizeBytes: 1024,
    createdAt: new Date().toISOString(),
  };

  it('parses valid metadata', () => {
    expect(FileMetaSchema.parse(meta)).toEqual(meta);
  });

  it('rejects invalid ids, sizes and empty names', () => {
    expect(() => FileMetaSchema.parse({ ...meta, id: 'not-a-uuid' })).toThrow();
    expect(() => FileMetaSchema.parse({ ...meta, sizeBytes: -1 })).toThrow();
    expect(() => FileMetaSchema.parse({ ...meta, sizeBytes: 1.5 })).toThrow();
    expect(() => FileMetaSchema.parse({ ...meta, fileName: '' })).toThrow();
    expect(() => FileMetaSchema.parse({ ...meta, key: '' })).toThrow();
    expect(() => FileMetaSchema.parse({ ...meta, createdAt: 'yesterday' })).toThrow();
  });
});
