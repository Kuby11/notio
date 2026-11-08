import { describe, expect, it } from 'vitest';
import { ARCHIVE_RETENTION_DAYS, createWorkspaceService } from '../src/services/workspace.service';
import { WorkspaceRepository } from '../src/repositories/workspace.repository';
import {
  TEST_ENV,
  call,
  createWorkspace,
  giveRole,
  jsonOf,
  newUserId,
  type WorkspaceBody,
} from './helpers';

describe('workspace list', () => {
  it('creates a personal workspace when the user has none yet', async () => {
    const userId = newUserId();

    const response = await call('/workspaces', { userId });
    const body = await jsonOf<{ items: WorkspaceBody[] }>(response);

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.name).toBe('Personal workspace');
  });

  it('returns only the active workspaces of the user', async () => {
    const userId = newUserId();
    const first = await createWorkspace(userId, 'First');
    await createWorkspace(userId, 'Second');
    await call(`/workspaces/${first.id}`, { method: 'DELETE', userId });

    const body = await jsonOf<{ items: WorkspaceBody[] }>(await call('/workspaces', { userId }));

    expect(body.items.map((item) => item.name)).toEqual(['Second']);
  });
});

describe('creation and reading', () => {
  it('makes the creator the owner and transliterates the slug', async () => {
    const userId = newUserId();
    const workspace = await createWorkspace(userId, 'Мой офис');

    expect(workspace.slug).toBe('moy-ofis');

    const members = await jsonOf<{ items: { userId: string; role: string }[] }>(
      await call(`/workspaces/${workspace.id}/members`, { userId }),
    );

    expect(members.items).toEqual([expect.objectContaining({ userId, role: 'owner' })]);
  });

  it('appends a number to a taken slug', async () => {
    const userId = newUserId();
    await createWorkspace(userId, 'Команда');
    const second = await createWorkspace(newUserId(), 'Команда');

    expect(second.slug).toBe('komanda-2');
  });

  it('hides a foreign workspace and does not confirm its existence', async () => {
    const owner = newUserId();
    const stranger = newUserId();
    const workspace = await createWorkspace(owner, 'Foreign');

    const existingButForbidden = await call(`/workspaces/${workspace.id}`, { userId: stranger });
    const missing = await call(`/workspaces/${newUserId()}`, { userId: stranger });

    // Both answers are identical: otherwise enumeration would reveal
    // which workspaces exist.
    expect(existingButForbidden.status).toBe(404);
    expect(missing.status).toBe(404);
    expect(await existingButForbidden.json()).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects a request without an actor identity', async () => {
    const response = await call('/workspaces');

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('responds 400 to an invalid body', async () => {
    const response = await call('/workspaces', { body: { name: '' }, userId: newUserId() });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('workspace update', () => {
  it('only the owner can rename: editor has no settings permission', async () => {
    const owner = newUserId();
    const editor = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await giveRole(workspace.id, editor, 'editor');

    const ownerRename = await call(`/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: { name: 'Project A' },
      userId: owner,
    });
    const editorRename = await call(`/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: { name: 'Project B' },
      userId: editor,
    });

    expect(ownerRename.status).toBe(200);
    expect(editorRename.status).toBe(403);
  });

  it('forbids viewer from changing the workspace', async () => {
    const owner = newUserId();
    const viewer = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await giveRole(workspace.id, viewer, 'viewer');

    const response = await call(`/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: { name: 'Project B' },
      userId: viewer,
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'FORBIDDEN' });
  });

  it('requires at least one field in PATCH', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');

    const response = await call(`/workspaces/${workspace.id}`, {
      method: 'PATCH',
      body: {},
      userId: owner,
    });

    expect(response.status).toBe(400);
  });
});

describe('archive and restore', () => {
  it('only the owner archives, and the workspace is hidden from members', async () => {
    const owner = newUserId();
    const editor = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await giveRole(workspace.id, editor, 'editor');

    const editorDelete = await call(`/workspaces/${workspace.id}`, {
      method: 'DELETE',
      userId: editor,
    });
    const ownerDelete = await call(`/workspaces/${workspace.id}`, {
      method: 'DELETE',
      userId: owner,
    });
    const editorRead = await call(`/workspaces/${workspace.id}`, { userId: editor });

    expect(editorDelete.status).toBe(403);
    expect(ownerDelete.status).toBe(200);
    expect(editorRead.status).toBe(404);
  });

  it('restores the workspace from the archive before retention expires', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await call(`/workspaces/${workspace.id}`, { method: 'DELETE', userId: owner });

    const restored = await call(`/workspaces/${workspace.id}/restore`, {
      method: 'POST',
      userId: owner,
    });

    expect(restored.status).toBe(200);
    expect((await jsonOf<WorkspaceBody>(restored)).archivedAt).toBeNull();
  });

  it('cron deletes the archived workspace after the retention period', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await call(`/workspaces/${workspace.id}`, { method: 'DELETE', userId: owner });

    // The service clock is moved past the retention period: the archive "aged".
    const laterThanRetention = new Date(
      Date.now() + (ARCHIVE_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    const removed = await createWorkspaceService(TEST_ENV, () => laterThanRetention).purgeExpired();

    expect(removed).toBeGreaterThanOrEqual(1);
    expect(await new WorkspaceRepository(TEST_ENV).findById(workspace.id)).toBeNull();
  });

  it('cron leaves a fresh archive and active workspaces alone', async () => {
    const owner = newUserId();
    const workspace = await createWorkspace(owner, 'Project');
    await call(`/workspaces/${workspace.id}`, { method: 'DELETE', userId: owner });

    const removed = await createWorkspaceService(TEST_ENV, () => new Date()).purgeExpired();
    const repository = new WorkspaceRepository(TEST_ENV);

    expect(removed).toBe(0);
    expect(await repository.findById(workspace.id)).not.toBeNull();
  });
});
