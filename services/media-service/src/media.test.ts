import { env as workerEnv } from 'cloudflare:workers';
import { INTERNAL_HEADERS, PROBLEM_CONTENT_TYPE } from '@notio/contracts';
import { describe, expect, it } from 'vitest';
import { createMediaServiceApp } from './app';
import type { Bindings } from './env';
import { parseRangeHeader } from './routes/media';

const app = createMediaServiceApp();
const env: Bindings = workerEnv;

const ACTOR_ID = '00000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000002';

function uploadRequest(file: File, headers: Record<string, string> = {}): Request {
  const form = new FormData();

  form.set('workspaceId', WORKSPACE_ID);
  form.set('file', file);

  return new Request('http://localhost/media/files', {
    method: 'POST',
    headers: { [INTERNAL_HEADERS.ACTOR_ID]: ACTOR_ID, ...headers },
    body: form,
  });
}

describe('media-service /health', () => {
  it('отвечает ok и описывает сам сервис', async () => {
    const response = await app.request('/health', {}, env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: 'ok',
      services: [{ service: 'media-service', status: 'ok' }],
    });
  });

  it('имеет бакет R2 в биндингах', () => {
    expect(env.MEDIA).toBeDefined();
  });
});

describe('media-service /media/files', () => {
  it('принимает маленькое изображение и отдаёт его по id', async () => {
    const file = new File([new Uint8Array([137, 80, 78, 71])], 'pic.png', {
      type: 'image/png',
    });
    const uploaded = await app.request(uploadRequest(file), {}, env);
    const meta = (await uploaded.json()) as { id: string; mimeType: string };

    expect(uploaded.status).toBe(201);
    expect(meta.mimeType).toBe('image/png');

    const response = await app.request(`http://localhost/media/files/${meta.id}`, {}, env);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
    expect(response.headers.get('accept-ranges')).toBe('bytes');
  });

  it('принимает файл с неизвестным браузеру MIME-типом как бинарный', async () => {
    const file = new File([new Uint8Array([1])], 'boot.exe', { type: '' });

    const response = await app.request(uploadRequest(file), {}, env);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ mimeType: 'application/octet-stream' });
  });

  it('отклоняет изображение больше 20 МБ', async () => {
    const file = new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.png', {
      type: 'image/png',
    });

    const response = await app.request(uploadRequest(file), {}, env);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });

  it('отклоняет видео больше 50 МБ', async () => {
    // A sparse array does not work here: File computes size from actual bytes.
    const bytes = new Uint8Array(50 * 1024 * 1024 + 1);

    const file = new File([bytes], 'clip.mp4', { type: 'video/mp4' });

    const response = await app.request(uploadRequest(file), {}, env);

    expect(response.status).toBe(413);
  });

  it('требует идентичность из gateway', async () => {
    const form = new FormData();

    form.set('workspaceId', WORKSPACE_ID);
    form.set('file', new File([new Uint8Array([1])], 'a.png', { type: 'image/png' }));

    const response = await app.request(
      new Request('http://localhost/media/files', { method: 'POST', body: form }),
      {},
      env,
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toBe(PROBLEM_CONTENT_TYPE);
  });

  it('отдаёт 404 на неизвестный id', async () => {
    const response = await app.request(
      'http://localhost/media/files/00000000-0000-4000-8000-0000000000ff',
      {},
      env,
    );

    expect(response.status).toBe(404);
  });

  it('отдаёт часть файла по Range и мету по HEAD', async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], 'r.png', { type: 'image/png' });
    const uploaded = await app.request(uploadRequest(file), {}, env);
    const meta = (await uploaded.json()) as { id: string };

    const range = await app.request(
      new Request(`http://localhost/media/files/${meta.id}`, {
        headers: { range: 'bytes=1-3' },
      }),
      {},
      env,
    );

    expect(range.status).toBe(206);
    expect(range.headers.get('content-range')).toBe('bytes 1-3/5');
    expect(new Uint8Array(await range.arrayBuffer())).toEqual(new Uint8Array([2, 3, 4]));

    const head = await app.request(
      new Request(`http://localhost/media/files/${meta.id}`, { method: 'HEAD' }),
      {},
      env,
    );

    expect(head.status).toBe(200);
    expect(head.headers.get('content-length')).toBe('5');
    expect(head.body).toBeNull();
    // The client needs the filename: the file block shows it through HEAD.
    expect(head.headers.get('content-disposition')).toContain(encodeURIComponent('r.png'));
  });

  it('превращает ответ в сохранение файла по ?download=1', async () => {
    const file = new File([new Uint8Array([9])], 'док.pdf', { type: 'application/pdf' });
    const uploaded = await app.request(uploadRequest(file), {}, env);
    const meta = (await uploaded.json()) as { id: string };

    const response = await app.request(
      `http://localhost/media/files/${meta.id}?download=1`,
      {},
      env,
    );

    expect(response.headers.get('content-disposition')).toContain('attachment');
    expect(response.headers.get('content-disposition')).toContain(encodeURIComponent('док.pdf'));
  });
});

describe('parseRangeHeader', () => {
  it('разбирает диапазоны, суффиксы и отвергает мусор', () => {
    expect(parseRangeHeader('bytes=0-1', 5)).toEqual({ offset: 0, length: 2 });
    expect(parseRangeHeader('bytes=2-', 5)).toEqual({ offset: 2, length: 3 });
    expect(parseRangeHeader('bytes=-2', 5)).toEqual({ offset: 3, length: 2 });
    expect(parseRangeHeader('bytes=4-9', 5)).toEqual({ offset: 4, length: 1 });
    expect(parseRangeHeader(undefined, 5)).toBeUndefined();
    expect(parseRangeHeader('bytes=5-6', 5)).toBeUndefined();
    expect(parseRangeHeader('bytes=a-b', 5)).toBeUndefined();
    expect(parseRangeHeader('bytes=1-2,4-5', 5)).toBeUndefined();
  });
});
