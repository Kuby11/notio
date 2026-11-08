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
 * The environment comes from the real wrangler config, so the tests also
 * verify that the service bindings match its Bindings type.
 */
interface Api {
  createPage(body: unknown, actor?: string): Promise<Response>;
  listPages(query: string): Promise<Response>;
  listAll(query: string): Promise<Response>;
  listFavorites(query: string): Promise<Response>;
  listTrash(query: string): Promise<Response>;
  searchPages(query: string): Promise<Response>;
  getPage(id: string, query?: string): Promise<Response>;
  patchPage(id: string, query: string, body: unknown): Promise<Response>;
}

/** Sends a request to the app: Hono returns a union, tests need a Promise. */
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
    listAll: (query) => send(`/pages/all?${query}`, {}),
    listFavorites: (query) => send(`/pages/favorites?${query}`, {}),
    listTrash: (query) => send(`/pages/trash?${query}`, {}),
    searchPages: (query) => send(`/pages/search?${query}`, {}),
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
  it('creates a page at the workspace root', async () => {
    const response = await api().createPage({ workspaceId, title: 'First page' });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      workspaceId,
      parentId: null,
      title: 'First page',
      isFavorite: false,
      isTrashed: false,
      createdBy: ACTOR,
    });
  });

  it('does not create a page without a user context (fail closed)', async () => {
    const response = await Promise.resolve(
      app.request('/pages', json({ workspaceId, title: 'No author' }), env),
    );

    expect(response.status).toBe(403);
    expect(await problemOf(response)).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects a body that fails Zod with a list of fields', async () => {
    const response = await api().createPage({ workspaceId: 'not-a-uuid', title: 'x'.repeat(501) });

    expect(response.status).toBe(400);
    const problem = await problemOf(response);
    expect(problem).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect((problem['errors'] as { path: string }[]).map((error) => error.path)).toContain(
      'workspaceId',
    );
  });

  it('rejects extra fields in the input', async () => {
    const response = await api().createPage({ workspaceId, isAdmin: true });

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('responds 400 when the body is not JSON', async () => {
    const response = await Promise.resolve(
      app.request(
        '/pages',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
          body: 'not json',
        },
        env,
      ),
    );

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('forbids a parent from a foreign workspace', async () => {
    const parent = await createPage({ workspaceId, title: 'Parent' });

    const response = await api().createPage({
      workspaceId: otherWorkspaceId,
      parentId: parent.id,
      title: 'Foreign parent',
    });

    expect(response.status).toBe(403);
    expect(await problemOf(response)).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('forbids a parent that does not exist', async () => {
    const response = await api().createPage({
      workspaceId,
      parentId: crypto.randomUUID(),
      title: 'Orphan',
    });

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('forbids creating a page inside a trashed page', async () => {
    const parent = await createPage({ workspaceId, title: 'In trash' });
    await api().patchPage(parent.id, `workspaceId=${workspaceId}`, { isTrashed: true });

    const response = await api().createPage({ workspaceId, parentId: parent.id, title: 'Inside' });

    expect(response.status).toBe(409);
    expect(await problemOf(response)).toMatchObject({ code: 'CONFLICT' });
  });
});

describe('GET /pages', () => {
  it('returns child pages in fractional indexing order', async () => {
    const client = api();
    const first = (await (await client.createPage({ workspaceId, title: 'First' })).json()) as {
      id: string;
    };
    await client.createPage({ workspaceId, title: 'Second' });
    await client.createPage({ workspaceId, title: 'Third' });

    const response = await client.listPages(`workspaceId=${workspaceId}`);
    const body = (await response.json()) as {
      items: { title: string }[];
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.title)).toEqual(['First', 'Second', 'Third']);
    expect(body.nextCursor).toBeNull();

    // Inserting between neighbours rewrites no existing positions.
    await client.createPage({ workspaceId, title: 'Between', afterPageId: first.id });

    const after = (await (await client.listPages(`workspaceId=${workspaceId}`)).json()) as {
      items: { title: string }[];
    };

    expect(after.items.map((item) => item.title)).toEqual(['First', 'Between', 'Second', 'Third']);
  });

  it('marks hasChildren only for pages with visible children', async () => {
    const client = api();
    const parent = await createPage({ workspaceId, title: 'Parent' });
    const child = await createPage({ workspaceId, parentId: parent.id, title: 'Child' });
    await client.createPage({ workspaceId, title: 'Leaf' });

    const body = (await (await client.listPages(`workspaceId=${workspaceId}`)).json()) as {
      items: { title: string; hasChildren: boolean }[];
    };
    const byTitle = new Map(body.items.map((item) => [item.title, item.hasChildren]));

    expect(byTitle.get('Parent')).toBe(true);
    expect(byTitle.get('Leaf')).toBe(false);

    // A trashed child must not make the parent expandable.
    await client.patchPage(child.id, `workspaceId=${workspaceId}`, { isTrashed: true });

    const visible = (await (await client.listPages(`workspaceId=${workspaceId}`)).json()) as {
      items: { title: string; hasChildren: boolean }[];
    };
    const withTrashed = (await (
      await client.listPages(`workspaceId=${workspaceId}&includeTrashed=true`)
    ).json()) as { items: { title: string; hasChildren: boolean }[] };

    expect(visible.items.find((item) => item.title === 'Parent')?.hasChildren).toBe(false);
    expect(withTrashed.items.find((item) => item.title === 'Parent')?.hasChildren).toBe(true);
  });

  it('does not return pages of a foreign workspace', async () => {
    await api().createPage({ workspaceId, title: 'Own' });

    const body = (await (await api().listPages(`workspaceId=${otherWorkspaceId}`)).json()) as {
      items: unknown[];
    };

    expect(body.items).toEqual([]);
  });

  it('paginates with a cursor instead of an offset', async () => {
    const client = api();
    for (const title of ['One', 'Two', 'Three']) {
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

    expect(secondPage.items.map((item) => item.title)).toEqual(['Three']);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('distinguishes includeTrashed=true from false', async () => {
    const client = api();
    const page = await createPage({ workspaceId, title: 'Junk' });
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

  it('rejects a limit outside the 1..100 range', async () => {
    const response = await api().listPages(`workspaceId=${workspaceId}&limit=101`);

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /pages/all', () => {
  it('returns all workspace pages as a flat list with the has-children flag', async () => {
    const client = api();
    const root = await createPage({ workspaceId, title: 'Root' });
    const child = await createPage({ workspaceId, parentId: root.id, title: 'Nested' });
    const trashed = await createPage({ workspaceId, title: 'Deleted' });
    await createPage({ workspaceId: otherWorkspaceId, title: 'Foreign' });

    await client.patchPage(trashed.id, `workspaceId=${workspaceId}`, { isTrashed: true });

    const response = await client.listAll(`workspaceId=${workspaceId}`);
    const body = (await response.json()) as {
      items: { id: string; title: string; parentId: string | null; hasChildren?: boolean }[];
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    // Both levels in one answer: the library nests them on the client.
    expect(body.items.map((item) => item.title).toSorted()).toEqual(['Nested', 'Root']);
    expect(body.items.find((item) => item.id === child.id)?.parentId).toBe(root.id);
    // The chevron in the table comes from this flag.
    expect(body.items.find((item) => item.id === root.id)?.hasChildren).toBe(true);
    expect(body.items.some((item) => item.id === trashed.id)).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it('rejects a workspaceId without a UUID', async () => {
    const response = await api().listAll('workspaceId=not-a-uuid');

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /pages/favorites', () => {
  it('collects favorites from all levels and hides the trash and foreign workspaces', async () => {
    const client = api();
    const root = await createPage({ workspaceId, title: 'Root' });
    const child = await createPage({ workspaceId, parentId: root.id, title: 'Nested' });
    const trashed = await createPage({ workspaceId, title: 'Deleted' });
    const foreign = await createPage({ workspaceId: otherWorkspaceId, title: 'Foreign' });

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
    expect(body.items.map((item) => item.title).toSorted()).toEqual(['Nested', 'Root']);
    expect(body.nextCursor).toBeNull();
  });

  it('rejects a workspaceId without a UUID', async () => {
    const response = await api().listFavorites('workspaceId=not-a-uuid');

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /pages/trash', () => {
  it('collects deleted pages from all levels and never returns foreign ones', async () => {
    const client = api();
    const root = await createPage({ workspaceId, title: 'Root' });
    const child = await createPage({ workspaceId, parentId: root.id, title: 'Nested' });
    const active = await createPage({ workspaceId, title: 'Alive' });
    const foreign = await createPage({ workspaceId: otherWorkspaceId, title: 'Foreign' });

    await client.patchPage(root.id, `workspaceId=${workspaceId}`, { isTrashed: true });
    await client.patchPage(child.id, `workspaceId=${workspaceId}`, { isTrashed: true });
    await client.patchPage(foreign.id, `workspaceId=${otherWorkspaceId}`, { isTrashed: true });

    const response = await client.listTrash(`workspaceId=${workspaceId}`);
    const body = (await response.json()) as {
      items: { id: string; title: string }[];
      nextCursor: string | null;
    };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.title).toSorted()).toEqual(['Nested', 'Root']);
    expect(body.items.some((item) => item.id === active.id)).toBe(false);
    expect(body.nextCursor).toBeNull();
  });

  it('rejects a workspaceId without a UUID', async () => {
    const response = await api().listTrash('workspaceId=not-a-uuid');

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /pages/search', () => {
  it('searches by title across all levels and hides the trash and foreign workspaces', async () => {
    const client = api();
    const root = await createPage({ workspaceId, title: 'Дорожная карта' });
    await createPage({ workspaceId, parentId: root.id, title: 'Вложенная Дорожная карта' });
    const trashed = await createPage({ workspaceId, title: 'Дорожная карта в корзине' });
    await createPage({ workspaceId: otherWorkspaceId, title: 'Дорожная карта' });
    await createPage({ workspaceId, title: 'Other' });

    await client.patchPage(trashed.id, `workspaceId=${workspaceId}`, { isTrashed: true });

    const response = await client.searchPages(
      `workspaceId=${workspaceId}&q=${encodeURIComponent('дорожная')}`,
    );
    const body = (await response.json()) as { items: { title: string }[] };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.title).toSorted()).toEqual([
      'Вложенная Дорожная карта',
      'Дорожная карта',
    ]);
  });

  it('treats % in the query as literal text, not a wildcard', async () => {
    const client = api();
    await createPage({ workspaceId, title: '100% cotton' });
    await createPage({ workspaceId, title: '100 dollars' });

    const response = await client.searchPages(
      `workspaceId=${workspaceId}&q=${encodeURIComponent('100%')}`,
    );
    const body = (await response.json()) as { items: { title: string }[] };

    expect(response.status).toBe(200);
    expect(body.items.map((item) => item.title)).toEqual(['100% cotton']);
  });

  it('rejects an empty query and a workspaceId without a UUID', async () => {
    const empty = await api().searchPages(`workspaceId=${workspaceId}&q=`);
    expect(empty.status).toBe(400);
    expect(await problemOf(empty)).toMatchObject({ code: 'VALIDATION_ERROR' });

    const badWorkspace = await api().searchPages('workspaceId=not-a-uuid&q=something');
    expect(badWorkspace.status).toBe(400);
    expect(await problemOf(badWorkspace)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('GET /pages/:id', () => {
  it('returns the page', async () => {
    const created = await createPage({ workspaceId, title: 'Find' });

    const response = await api().getPage(created.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: created.id, title: 'Find' });
  });

  it('hides a foreign-workspace page behind a 404 (IDOR protection)', async () => {
    const created = await createPage({ workspaceId, title: 'Foreign' });

    const response = await api().getPage(created.id, `workspaceId=${otherWorkspaceId}`);

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('responds 400 to an invalid identifier', async () => {
    const response = await api().getPage('not-a-uuid');

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('responds 404 for a nonexistent page', async () => {
    const response = await api().getPage(crypto.randomUUID());

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('PATCH /pages/:id', () => {
  it('updates the title and modification time', async () => {
    const client = api();
    const created = await createPage({ workspaceId, title: 'Before' });

    const response = await client.patchPage(created.id, `workspaceId=${workspaceId}`, {
      title: 'After',
      isFavorite: true,
    });
    const page = (await response.json()) as { title: string; isFavorite: boolean };

    expect(response.status).toBe(200);
    expect(page).toMatchObject({ title: 'After', isFavorite: true });
  });

  it('does not change a page of a foreign workspace', async () => {
    const created = await createPage({ workspaceId, title: 'Foreign' });

    const response = await api().patchPage(created.id, `workspaceId=${otherWorkspaceId}`, {
      title: 'Hack',
    });

    expect(response.status).toBe(404);
    expect(await problemOf(response)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects an empty update', async () => {
    const created = await createPage({ workspaceId, title: 'Something' });

    const response = await api().patchPage(created.id, `workspaceId=${workspaceId}`, {});

    expect(response.status).toBe(400);
    expect(await problemOf(response)).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
