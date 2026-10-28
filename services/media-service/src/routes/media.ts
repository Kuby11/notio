import { FileMetaSchema, IdSchema, INTERNAL_HEADERS } from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ForbiddenError, ValidationError } from '../errors';
import { createMediaService } from '../services/media.service';

/** Parses the Range header: only a single `bytes=start-end` range. */
export function parseRangeHeader(
  header: string | undefined,
  size: number,
): { offset: number; length: number } | undefined {
  if (!header) {
    return undefined;
  }

  const match = /^bytes=(\d*)-(\d*)$/u.exec(header.trim());

  if (!match || (match[1] === '' && match[2] === '')) {
    return undefined;
  }

  const [, startRaw = '', endRaw = ''] = match;
  let start: number;
  let end: number;

  if (startRaw === '') {
    // Suffix range: the last N bytes.
    const suffix = Number.parseInt(endRaw, 10);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number.parseInt(startRaw, 10);
    end = endRaw === '' ? size - 1 : Math.min(Number.parseInt(endRaw, 10), size - 1);
  }

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return undefined;
  }

  return { offset: start, length: end - start + 1 };
}

/**
 * File routes. HTTP lives here and only here: input validation, calling the
 * scenario and building the response to the contract.
 */
export function createMediaRoutes(): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.post('/media/files', async (c) => {
    const actorId = c.req.header(INTERNAL_HEADERS.ACTOR_ID);

    if (!actorId) {
      // The gateway always passes a signed identity after JWT;
      // an empty header means the service was called bypassing the gateway.
      throw new ForbiddenError('Не удалось определить пользователя по контексту запроса');
    }

    IdSchema.parse(actorId);

    const form = await c.req.raw.formData();
    const workspaceId = form.get('workspaceId');
    const file = form.get('file');

    if (typeof workspaceId !== 'string') {
      throw new ValidationError('workspaceId обязателен');
    }

    const parsedWorkspaceId = IdSchema.parse(workspaceId);

    if (!(file instanceof File)) {
      throw new ValidationError('file обязателен и должен быть файлом');
    }

    const meta = await createMediaService(c.env).upload({
      workspaceId: parsedWorkspaceId,
      actorId,
      fileName: file.name || 'file',
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      body: file.stream(),
    });

    return c.json(FileMetaSchema.parse(meta), 201);
  });

  // GET returns the file (with Range support for video scrubbing), HEAD returns metadata.
  routes.on(['GET', 'HEAD'], '/media/files/:id', async (c) => {
    const id = IdSchema.parse(c.req.param('id'));
    const service = createMediaService(c.env);

    if (c.req.method === 'HEAD') {
      const object = await service.head(id);
      const fileName = object.customMetadata?.['fileName'] ?? id;

      return c.newResponse(null, 200, {
        'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
        'content-length': String(object.size),
        etag: object.etag,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=31536000, immutable',
        // The filename goes in the header: the client shows it on the file block
        // when it has no name of its own (for example after converting from an image).
        'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      });
    }

    const head = await service.head(id);
    const range = parseRangeHeader(c.req.header('range'), head.size);

    if (range) {
      const object = await service.get(id, range);

      return c.newResponse(object.body, 206, {
        'content-type': head.httpMetadata?.contentType ?? 'application/octet-stream',
        'content-length': String(range.length),
        'content-range': `bytes ${range.offset}-${range.offset + range.length - 1}/${head.size}`,
        etag: head.etag,
        'accept-ranges': 'bytes',
        'cache-control': 'public, max-age=31536000, immutable',
      });
    }

    const object = await service.get(id);

    return c.newResponse(object.body, 200, {
      'content-type': head.httpMetadata?.contentType ?? 'application/octet-stream',
      'content-length': String(head.size),
      etag: head.etag,
      'accept-ranges': 'bytes',
      'cache-control': 'public, max-age=31536000, immutable',
      // ?download=1 turns the response into a file save with the original name.
      ...(new URL(c.req.url).searchParams.has('download')
        ? {
            'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(
              head.customMetadata?.['fileName'] ?? id,
            )}`,
          }
        : {}),
    });
  });

  return routes;
}
