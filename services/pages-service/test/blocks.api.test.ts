import { INTERNAL_HEADERS } from '@notio/contracts';
import { env as workerEnv } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { createPagesServiceApp } from '../src/app';
import type { Bindings } from '../src/env';

const app = createPagesServiceApp();
const env: Bindings = workerEnv;

const ACTOR = '00000000-0000-4000-8000-00000000000a';

function send(path: string, init: RequestInit): Promise<Response> {
  return Promise.resolve(app.request(path, init, env));
}

async function createPage(workspaceId: string, title = 'Test page'): Promise<{ id: string }> {
  const response = await send('/pages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
    body: JSON.stringify({ workspaceId, title }),
  });

  if (response.status !== 201) {
    throw new Error(`Failed to create the page: ${response.status}`);
  }

  return (await response.json()) as { id: string };
}

async function patchPage(pageId: string, workspaceId: string, body: unknown): Promise<Response> {
  return send(`/pages/${pageId}?workspaceId=${workspaceId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('page blocks', () => {
  it('creates a block and returns it per the contract', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    const response = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'Hello' } }),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      pageId: page.id,
      type: 'paragraph',
      content: { type: 'paragraph', content: 'Hello' },
    });
  });

  it('does not create a block without a user context', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    const response = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'x' } }),
    });

    expect(response.status).toBe(403);
  });

  it('rejects an unknown block type', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    const response = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'unknown', content: 'x' } }),
    });

    expect(response.status).toBe(400);
  });

  it('returns the list of page blocks', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'First' } }),
    });

    const response = await send(`/pages/${page.id}/blocks`, {});

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { content: { content: string } }[] };

    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.content.content).toBe('First');
  });

  it('updates the block content', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    const created = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'Old' } }),
    });
    const block = (await created.json()) as { id: string };

    const response = await send(`/blocks/${block.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: { type: 'paragraph', content: 'New' } }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ content: { content: 'New' } });
  });

  it('deletes a block', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    const created = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({
        pageId: page.id,
        content: { type: 'paragraph', content: 'Deleting' },
      }),
    });
    const block = (await created.json()) as { id: string };

    const deleted = await send(`/blocks/${block.id}`, { method: 'DELETE' });

    expect(deleted.status).toBe(204);

    const list = await send(`/pages/${page.id}/blocks`, {});
    const body = (await list.json()) as { items: unknown[] };

    expect(body.items).toHaveLength(0);
  });

  it('responds 404 for a nonexistent block', async () => {
    const response = await send(`/blocks/00000000-0000-4000-8000-000000000099`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: { type: 'paragraph', content: 'x' } }),
    });

    expect(response.status).toBe(404);
  });

  it('moves a block after the specified sibling', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    const firstResponse = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'First' } }),
    });
    const secondResponse = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'Second' } }),
    });

    const firstBlock = (await firstResponse.json()) as { id: string };
    const secondBlock = (await secondResponse.json()) as { id: string };

    const moved = await send(`/blocks/${secondBlock.id}/move`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ afterBlockId: firstBlock.id }),
    });

    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject({ id: secondBlock.id });
  });

  it('responds 404 when moving a nonexistent block', async () => {
    const response = await send(`/blocks/00000000-0000-4000-8000-000000000099/move`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(404);
  });

  it('moves a block to the end of the list when no sibling is given', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'First' } }),
    });
    const second = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'Second' } }),
    });

    const secondBlock = (await second.json()) as { id: string };

    const moved = await send(`/blocks/${secondBlock.id}/move`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(moved.status).toBe(200);
    expect(await moved.json()).toMatchObject({ id: secondBlock.id });
  });

  it('responds 404 when deleting a nonexistent block', async () => {
    const response = await send(`/blocks/00000000-0000-4000-8000-000000000099`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
  });

  it('responds 404 when reading blocks of a nonexistent page', async () => {
    const response = await send(`/pages/00000000-0000-4000-8000-000000000099/blocks`, {});

    expect(response.status).toBe(404);
  });

  it('responds 404 when creating a block on a nonexistent page', async () => {
    const response = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({
        pageId: '00000000-0000-4000-8000-000000000099',
        content: { type: 'paragraph', content: 'x' },
      }),
    });

    expect(response.status).toBe(404);
  });

  it('responds 404 when creating a block on a trashed page', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await send(`/pages/${page.id}?workspaceId=${workspaceId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isTrashed: true }),
    });

    const response = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'x' } }),
    });

    expect(response.status).toBe(409);
  });
});

describe('page moves', () => {
  it('moves a page to another parent', async () => {
    const workspaceId = crypto.randomUUID();
    const parent = await createPage(workspaceId, 'Parent');
    const child = await createPage(workspaceId, 'Child');

    const response = await send(`/pages/${child.id}/move?workspaceId=${workspaceId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ parentId: parent.id }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: child.id, parentId: parent.id });
  });

  it('responds 404 when moving a nonexistent page', async () => {
    const workspaceId = crypto.randomUUID();

    const response = await send(
      `/pages/00000000-0000-4000-8000-000000000099/move?workspaceId=${workspaceId}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
        body: JSON.stringify({ parentId: null }),
      },
    );

    expect(response.status).toBe(404);
  });

  it('forbids moving a page inside its own descendant', async () => {
    const workspaceId = crypto.randomUUID();
    const parent = await createPage(workspaceId, 'Parent');
    const child = await createPage(workspaceId, 'Child');

    await send(`/pages/${child.id}/move?workspaceId=${workspaceId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ parentId: parent.id }),
    });

    const response = await send(`/pages/${parent.id}/move?workspaceId=${workspaceId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ parentId: child.id }),
    });

    expect(response.status).toBe(409);
  });
});

describe('page versioning', () => {
  it('creates a snapshot and returns it per the contract', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({
        pageId: page.id,
        content: { type: 'paragraph', content: 'Version 1' },
      }),
    });

    const created = await send(`/pages/${page.id}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
    });

    expect(created.status).toBe(201);
    const version = (await created.json()) as { pageId: string; content: unknown[] };

    expect(version.pageId).toBe(page.id);
    expect(version.content).toHaveLength(1);
  });

  it('returns the list of versions', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await send(`/pages/${page.id}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
    });

    const response = await send(`/pages/${page.id}/versions`, {});

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[] };

    expect(body.items).toHaveLength(1);
  });

  it('responds 404 for a nonexistent version', async () => {
    const response = await send(
      `/pages/00000000-0000-4000-8000-000000000001/versions/00000000-0000-4000-8000-000000000099`,
      {},
    );

    expect(response.status).toBe(404);
  });
});

describe('page locking and modification time', () => {
  it('toggles isLocked per the contract', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    const locked = await patchPage(page.id, workspaceId, { isLocked: true });

    expect(locked.status).toBe(200);
    expect(await locked.json()).toMatchObject({ isLocked: true });

    const unlocked = await patchPage(page.id, workspaceId, { isLocked: false });

    expect(await unlocked.json()).toMatchObject({ isLocked: false });
  });

  it('rejects block edits on a locked page', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await patchPage(page.id, workspaceId, { isLocked: true });

    const response = await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'x' } }),
    });

    expect(response.status).toBe(409);
  });

  it('allows reading blocks of a locked page', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await patchPage(page.id, workspaceId, { isLocked: true });

    const response = await send(`/pages/${page.id}/blocks`, {});

    expect(response.status).toBe(200);
  });

  it('editing blocks updates the page updatedAt', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);
    const before = (
      (await (await send(`/pages/${page.id}?workspaceId=${workspaceId}`, {})).json()) as {
        updatedAt: string;
      }
    ).updatedAt;

    // ISO time with millisecond precision: give the clock a chance to move forward.
    await new Promise((resolve) => setTimeout(resolve, 5));

    await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({ pageId: page.id, content: { type: 'paragraph', content: 'x' } }),
    });

    const after = (
      (await (await send(`/pages/${page.id}?workspaceId=${workspaceId}`, {})).json()) as {
        updatedAt: string;
      }
    ).updatedAt;

    expect(after > before).toBe(true);
  });
});

describe('page versioning', () => {
  it('creates a snapshot and returns it per the contract', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await send('/blocks', {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
      body: JSON.stringify({
        pageId: page.id,
        content: { type: 'paragraph', content: 'Version 1' },
      }),
    });

    const created = await send(`/pages/${page.id}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
    });

    expect(created.status).toBe(201);
    const version = (await created.json()) as { pageId: string; content: unknown[] };

    expect(version.pageId).toBe(page.id);
    expect(version.content).toHaveLength(1);
  });

  it('returns the list of versions', async () => {
    const workspaceId = crypto.randomUUID();
    const page = await createPage(workspaceId);

    await send(`/pages/${page.id}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: ACTOR },
    });

    const response = await send(`/pages/${page.id}/versions`, {});

    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[] };

    expect(body.items).toHaveLength(1);
  });

  it('responds 404 for a nonexistent version', async () => {
    const response = await send(
      `/pages/00000000-0000-4000-8000-000000000001/versions/00000000-0000-4000-8000-000000000099`,
      {},
    );

    expect(response.status).toBe(404);
  });
});
