// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileMeta } from '@notio/contracts';
import { createMediaRepositoryApi } from './media.api';
import type { TokenProvider } from '../../../shared/types';

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001';
const FILE_ID = '00000000-0000-4000-8000-000000000010';
const NOW = '2026-01-01T00:00:00.000Z';

const META: FileMeta = {
  id: FILE_ID,
  workspaceId: WORKSPACE_ID,
  key: FILE_ID,
  fileName: 'pic.png',
  mimeType: 'image/png',
  sizeBytes: 4,
  createdAt: NOW,
};

const tokenProvider: TokenProvider = { execute: async () => 'jwt' };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(META, 201)),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createMediaRepositoryApi', () => {
  it('отправляет multipart и разбирает FileMeta', async () => {
    const repository = createMediaRepositoryApi(tokenProvider);
    const file = new File([new Uint8Array([1, 2, 3, 4])], 'pic.png', { type: 'image/png' });

    const meta = await repository.upload({ workspaceId: WORKSPACE_ID, file });

    expect(meta).toEqual(META);

    const [input, init] = vi.mocked(fetch).mock.calls[0] ?? [];

    expect(String(input)).toContain('/api/media/files');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);

    const body = init?.body;

    expect(body).toBeInstanceOf(FormData);
    expect(body instanceof FormData ? body.get('file') : null).toBe(file);
  });

  it('превращает 413 в HttpError с деталью сервиса', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          { status: 413, code: 'PAYLOAD_TOO_LARGE', detail: 'Файл больше лимита 20 МБ' },
          413,
        ),
      ),
    );

    const repository = createMediaRepositoryApi(tokenProvider);
    const file = new File([new Uint8Array([1])], 'huge.png', { type: 'image/png' });

    await expect(repository.upload({ workspaceId: WORKSPACE_ID, file })).rejects.toThrow(
      'Файл больше лимита 20 МБ',
    );
  });
});
