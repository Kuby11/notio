import { INTERNAL_HEADERS } from '@notio/contracts';
import { env as workerEnv } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { createPagesServiceApp } from '../src/app';
import type { Bindings } from '../src/env';

const app = createPagesServiceApp();
const env: Bindings = workerEnv;

const ACTOR = '00000000-0000-4000-8000-00000000000a';

function json(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Окружение берётся из настоящего wrangler-конфига, поэтому тесты заодно
 * проверяют, что биндинги сервиса совпадают с его типом Bindings.
 */
interface Api {
  createPage(body: unknown, actor?: string): Promise<Response>;
  listPages(query: string): Promise<Response>;
  listFavorites(query: string): Promise<Response>;
  getPage(id: string, query?: string): Promise<Response>;
  patchPage(id: string, query: string, body: unknown): Promise<Response>;
}

/** Отправляет запрос в приложение: Hono отдаёт union, тестам нужен Promise. */
function send(path: string, init: RequestInit): Promise<Response> {
  return Promise.resolve(app.request(path, init, env));
}

function api(): Api {
  return {
    createPage: (body, actor = ACTOR) =>
      send('/pages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: actor },
        body: JSON.stringify(body),
      }),
    listPages: (query) => send(`/pages?${query}`, {}),
    listFavorites: (query) => send(`/pages/favorites?${query}`, {}),
    getPage: (id, query = '') => send(`/pages/${id}${query === '' ? '' : `?${query}`}`, {}),
    patchPage: (id, query, body) =>
      send(`/pages/${id}?${query}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
  };
}

async function problemOf(response: Response): Promise<Record<string, unknown>> {
  expect(response.headers.get('content-type')).toBe('application/problem+json');
  return (await response.json()) as Record<string, unknown>;
}

async function createPage(body: Record<string, unknown>): Promise<{ id: string }> {
  const response = await api().createPage(body);

  return (await response.json()) as { id: string };
}

let workspaceId: string;
let otherWorkspaceId: string;

beforeEach(() => {
  workspaceId = crypto.randomUUID();
  otherWorkspaceId = crypto.randomUUID();
});

describe('POST /pages', () => {
  it('создаёт страницу в корне workspace', async () => {
    const response = await api().createPage({ workspaceId, title: 'Первая страница' });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      workspaceId,
      parentId: null,
      title: 'Первая страница',
      isFavorite: false,
      isTrashed: false,
      createdBy: ACTOR,
    });
  });

  it('не создаёт страницу без контекста пользователя (fail closed)', async () => {
    const response = await Promise.resolve(
      app.request('/pages', json({ workspaceId, title: 'Без автора' }), env),
    );

    expect(response.status).toBe(403);
    expect(await problemOf(response)).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('отклоняет тело, не прошедшее Zod, со списком полей', async () => {
    const response = await api().createPage({ workspaceId: 'не-uuid', title: 'x'.repeat(501) });

    expect(response.status).toBe(400);
    const problem = await problemOf(response);
    expect(problem).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((problem['errors'] as { path: string }[]).map((error) => error.path)).toContain(
      'workspaceId',
    );
  });

  it('отклоняет лишние поля во входных данных', async () => {
    const response = await api().createPage({ workspaceId, isAdmin: true });

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('отвечает 400, если тело не JSON', async () => {
    const response = await Promise.resolve(
      app.request(
        '/pages',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
          body: 'не json',
        },
        env,
      ),
    );

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('запрещает родителя из чужого workspace', async () => {
    const parent = await createPage({ workspaceId, title: 'Родитель' });

    const response = await api().createPage({
      workspaceId: otherWorkspaceId,
      parentId: parent.id,
      title: 'Чужой родитель',
    });

    expect(response.status).toBe(403);
    expect(await problemOf(response)).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('запрещает родителя, которого нет', async () => {
    const response = await api().createPage({
      workspaceId,
      parentId: crypto.randomUUID(),
      title: 'Сирота',
    });

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('запрещает создавать страницу внутри страницы в корзине', async () => {
    const parent = await createPage({ workspaceId, title: 'В корзине' });
    await api().patchPage(parent.id, `workspaceId=${workspaceId}`, { isTrashed: true });

    const response = await api().createPage({ workspaceId, parentId: parent.id, title: 'Внутри' });

    expect(response.status).toBe(409);
    expect(await problemOf(response)).toMatchObject({ code: 'CONFLICT' });
  });
});

describe('GET /pages', () => {
  it('возвращает дочерние страницы в порядке fractional indexing', async () => {
    const client = api();
    const first = (await (await client.createPage({ workspaceId, title: 'Первая' })).json()) as {
      id: string;
    };
    await client.createPage({ workspaceId, title: 'Вторая' });
    await client.createPage({ workspaceId, title: 'Третья' });

    const response = await client.listPages(`workspaceId=${workspaceId}`);
    const body = (await response.json()) as {
      items: { title: string }[];
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.title)).toEqual(['Первая', 'Вторая', 'Третья']);
    expect(body.nextCursor).toBeNull();

    // Вставка между соседями не переписывает существующие позиции.
    await client.createPage({ workspaceId, title: 'Между', afterPageId: first.id });

    const after = (await (await client.listPages(`workspaceId=${workspaceId}`)).json()) as {
      items: { title: string }[];
    };

    expect(after.items.map((item) => item.title)).toEqual(['Первая', 'Между', 'Вторая', 'Третья']);
  });

  it('не отдаёт страницы чужого workspace', async () => {
    await api().createPage({ workspaceId, title: 'Своя' });

    const body = (await (await api().listPages(`workspaceId=${otherWorkspaceId}`)).json()) as {
      items: unknown[];
    };

    expect(body.items).toEqual([]);
  });

  it('постранично отдаёт курсор вместо смещения', async () => {
    const client = api();
    for (const title of ['Один', 'Два', 'Три']) {
      await client.createPage({ workspaceId, title });
    }

    const firstPage = (await (
      await client.listPages(`workspaceId=${workspaceId}&limit=2`)
    ).json()) as { items: { title: string }[]; nextCursor: string | null };

    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = (await (
      await client.listPages(`workspaceId=${workspaceId}&limit=2&cursor=${firstPage.nextCursor}`)
    ).json()) as { items: { title: string }[]; nextCursor: string | null };

    expect(secondPage.items.map((item) => item.title)).toEqual(['Три']);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('различает includeTrashed=true и false', async () => {
    const client = api();
    const page = await createPage({ workspaceId, title: 'Мусор' });
    await client.patchPage(page.id, `workspaceId=${workspaceId}`, { isTrashed: true });

    const visible = (await (await client.listPages(`workspaceId=${workspaceId}`)).json()) as {
      items: unknown[];
    };
    const withTrashed = (await (
      await client.listPages(`workspaceId=${workspaceId}&includeTrashed=true`)
    ).json()) as { items: unknown[] };

    expect(visible.items).toHaveLength(0);
    expect(withTrashed.items).toHaveLength(1);
  });

  it('отклоняет limit вне диапазона 1..100', async () => {
    const response = await api().listPages(`workspaceId=${workspaceId}&limit=101`);

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /pages/favorites', () => {
  it('собирает избранное со всех уровней и скрывает корзину и чужие workspace', async () => {
    const client = api();
    const root = await createPage({ workspaceId, title: 'Корень' });
    const child = await createPage({ workspaceId, parentId: root.id, title: 'Вложенная' });
    const trashed = await createPage({ workspaceId, title: 'Удалённая' });
    const foreign = await createPage({ workspaceId: otherWorkspaceId, title: 'Чужая' });

    await client.patchPage(root.id, `workspaceId=${workspaceId}`, { isFavorite: true });
    await client.patchPage(child.id, `workspaceId=${workspaceId}`, { isFavorite: true });
    await client.patchPage(trashed.id, `workspaceId=${workspaceId}`, {
      isFavorite: true,
      isTrashed: true,
    });
    await client.patchPage(foreign.id, `workspaceId=${otherWorkspaceId}`, { isFavorite: true });

    const response = await client.listFavorites(`workspaceId=${workspaceId}`);
    const body = (await response.json()) as {
      items: { title: string }[];
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.title).toSorted()).toEqual(['Вложенная', 'Корень']);
    expect(body.nextCursor).toBeNull();
  });

  it('отклоняет workspaceId без UUID', async () => {
    const response = await api().listFavorites('workspaceId=не-uuid');

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /pages/:id', () => {
  it('возвращает страницу', async () => {
    const created = await createPage({ workspaceId, title: 'Найти' });

    const response = await api().getPage(created.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.id, title: 'Найти' });
  });

  it('скрывает страницу чужого workspace под 404 (защита от IDOR)', async () => {
    const created = await createPage({ workspaceId, title: 'Чужая' });

    const response = await api().getPage(created.id, `workspaceId=${otherWorkspaceId}`);

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('отвечает 400 на некорректный идентификатор', async () => {
    const response = await api().getPage('не-uuid');

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('отвечает 404 на несуществующую страницу', async () => {
    const response = await api().getPage(crypto.randomUUID());

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('PATCH /pages/:id', () => {
  it('обновляет заголовок и время изменения', async () => {
    const client = api();
    const created = await createPage({ workspaceId, title: 'Было' });

    const response = await client.patchPage(created.id, `workspaceId=${workspaceId}`, {
      title: 'Стало',
      isFavorite: true,
    });
    const page = (await response.json()) as { title: string; isFavorite: boolean };

    expect(response.status).toBe(200);
    expect(page).toMatchObject({ title: 'Стало', isFavorite: true });
  });

  it('не меняет страницу чужого workspace', async () => {
    const created = await createPage({ workspaceId, title: 'Чужая' });

    const response = await api().patchPage(created.id, `workspaceId=${otherWorkspaceId}`, {
      title: 'Взлом',
    });

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('отклоняет пустое обновление', async () => {
    const created = await createPage({ workspaceId, title: 'Что-то' });

    const response = await api().patchPage(created.id, `workspaceId=${workspaceId}`, {});

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
