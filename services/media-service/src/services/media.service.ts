import { isAllowedMimeType, maxUploadSizeForMime, newId, type FileMeta } from '@notio/contracts';
import type { Bindings } from '../env';
import { NotFoundError, PayloadTooLargeError, UnsupportedMediaTypeError } from '../errors';

/** The time source is injected so tests do not depend on the system clock. */
export type Clock = () => Date;

/**
 * Scenarios for working with files in R2.
 *
 * The object key is the file's UUID: the id is unpredictable, so there are no
 * direct enumerations and no predictable URLs. Metadata (name, workspace,
 * author) lives in the object's customMetadata: no separate database is needed,
 * and reading metadata takes no second request.
 */
export class MediaService {
  constructor(
    private readonly bucket: R2Bucket,
    private readonly clock: Clock,
  ) {}

  private now(): string {
    return this.clock().toISOString();
  }

  async upload(input: {
    workspaceId: string;
    actorId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    body: ReadableStream<Uint8Array> | ArrayBuffer;
  }): Promise<FileMeta> {
    if (!isAllowedMimeType(input.mimeType)) {
      throw new UnsupportedMediaTypeError(`Тип ${input.mimeType} не поддерживается`);
    }

    const limit = maxUploadSizeForMime(input.mimeType);

    if (input.sizeBytes > limit) {
      throw new PayloadTooLargeError(`Файл больше лимита ${Math.round(limit / (1024 * 1024))} МБ`);
    }

    const id = newId();

    await this.bucket.put(id, input.body, {
      httpMetadata: { contentType: input.mimeType },
      customMetadata: {
        fileName: input.fileName.slice(0, 255),
        workspaceId: input.workspaceId,
        createdBy: input.actorId,
      },
    });

    return {
      id,
      workspaceId: input.workspaceId,
      key: id,
      fileName: input.fileName.slice(0, 255),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      createdAt: this.now(),
    };
  }

  metaOf(object: R2Object): FileMeta {
    const custom = object.customMetadata ?? {};

    return {
      id: object.key,
      workspaceId: custom['workspaceId'] ?? '00000000-0000-4000-8000-000000000000',
      key: object.key,
      fileName: custom['fileName'] ?? object.key,
      mimeType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      sizeBytes: object.size,
      createdAt: object.uploaded.toISOString(),
    };
  }

  async head(id: string): Promise<R2Object> {
    const object = await this.bucket.head(id);

    if (!object) {
      throw new NotFoundError('Файл не найден');
    }

    return object;
  }

  async get(id: string, range?: { offset: number; length: number }): Promise<R2ObjectBody> {
    const object = await this.bucket.get(id, range ? { range } : undefined);

    if (!object) {
      throw new NotFoundError('Файл не найден');
    }

    return object;
  }
}

export function createMediaService(env: Bindings, clock: Clock = () => new Date()): MediaService {
  return new MediaService(env.MEDIA, clock);
}
