import { describe, expect, it } from 'vitest';
import { call, createWorkspace, giveRole, jsonOf, newUserId } from './helpers';

interface DatabaseBody {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  icon?: string;
  coverFileId?: string;
  isInline: boolean;
  properties: { id: string; name: string; type: string }[];
  defaultViewId?: string;
  isTrashed: boolean;
}

interface RowBody {
  id: string;
  databaseId: string;
  title: string;
  properties: Record<string, unknown>;
}

interface ViewBody {
  id: string;
  databaseId: string;
  name: string;
  type: string;
  filter?: { propertyId: string; operator: string };
  sorts: { propertyId: string; direction: string }[];
  groupBy?: { propertyId: string; sortDirection: string; hideEmpty: boolean };
  chart?: { groupPropertyId?: string | null };
  visiblePropertyIds: string[];
  columnWidths?: Record<string, number>;
  aggregations?: { propertyId: string; calculation: string }[];
}

const OWNER = () => newUserId();

async function createDatabase(userId: string, workspaceId: string, title = 'Tasks') {
  const response = await call(`/workspaces/${workspaceId}/databases`, {
    body: { workspaceId, title },
    userId,
  });

  expect(response.status).toBe(201);

  return jsonOf<DatabaseBody>(response);
}

describe('database creation', () => {
  it('creates a database with a default table view and returns it', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);

    expect(database.workspaceId).toBe(workspace.id);
    expect(database.title).toBe('Tasks');
    expect(database.isInline).toBe(false);
    expect(database.defaultViewId).toEqual(expect.any(String));

    const views = await jsonOf<ViewBody[]>(
      await call(`/databases/${database.id}/views`, { userId }),
    );

    expect(views.map((view) => view.id)).toEqual([database.defaultViewId]);
    expect(views[0]?.type).toBe('table');

    const listed = await jsonOf<DatabaseBody[]>(
      await call(`/workspaces/${workspace.id}/databases`, { userId }),
    );

    expect(listed.map((item) => item.id)).toEqual([database.id]);
  });

  it('hides a database in a foreign workspace behind a not-found', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);

    const response = await call(`/databases/${database.id}`, { userId: newUserId() });

    expect(response.status).toBe(404);
  });

  it('rejects creation for a non-member', async () => {
    const workspace = await createWorkspace(OWNER());

    const response = await call(`/workspaces/${workspace.id}/databases`, {
      body: { workspaceId: workspace.id, title: 'Sneaky' },
      userId: newUserId(),
    });

    expect(response.status).toBe(404);
  });
});

describe('database update', () => {
  it('renames a database', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);

    const response = await call(`/databases/${database.id}`, {
      method: 'PATCH',
      body: { title: 'Renamed' },
      userId,
    });
    const body = await jsonOf<DatabaseBody>(response);

    expect(response.status).toBe(200);
    expect(body.title).toBe('Renamed');
  });

  it('rejects an empty update', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);

    const response = await call(`/databases/${database.id}`, {
      method: 'PATCH',
      body: {},
      userId,
    });

    expect(response.status).toBe(400);
  });
});

describe('database rows', () => {
  it('creates, updates and deletes a row', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);

    const created = await jsonOf<RowBody>(
      await call(`/databases/${database.id}/rows`, {
        body: { databaseId: database.id, title: 'First row' },
        userId,
      }),
    );

    expect(created.databaseId).toBe(database.id);
    expect(created.title).toBe('First row');

    const updated = await jsonOf<RowBody>(
      await call(`/database-rows/${created.id}`, {
        method: 'PATCH',
        body: { title: 'Renamed row' },
        userId,
      }),
    );

    expect(updated.title).toBe('Renamed row');

    const removed = await call(`/database-rows/${created.id}`, { method: 'DELETE', userId });

    expect(removed.status).toBe(204);

    const rows = await jsonOf<RowBody[]>(await call(`/databases/${database.id}/rows`, { userId }));

    expect(rows).toHaveLength(0);
  });

  it('rejects a row update without fields', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);
    const row = await jsonOf<RowBody>(
      await call(`/databases/${database.id}/rows`, { body: { databaseId: database.id }, userId }),
    );

    const response = await call(`/database-rows/${row.id}`, {
      method: 'PATCH',
      body: {},
      userId,
    });

    expect(response.status).toBe(400);
  });

  it('does not let a viewer delete rows', async () => {
    const userId = OWNER();
    const viewerId = newUserId();
    const workspace = await createWorkspace(userId);
    await giveRole(workspace.id, viewerId, 'viewer');
    const database = await createDatabase(userId, workspace.id);
    const row = await jsonOf<RowBody>(
      await call(`/databases/${database.id}/rows`, { body: { databaseId: database.id }, userId }),
    );

    const response = await call(`/database-rows/${row.id}`, { method: 'DELETE', userId: viewerId });

    expect(response.status).toBe(404);
  });
});

describe('database views', () => {
  it('adds a second view and updates it', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);

    const created = await jsonOf<ViewBody>(
      await call(`/databases/${database.id}/views`, {
        body: { databaseId: database.id, name: 'Board', type: 'board' },
        userId,
      }),
    );

    expect(created.name).toBe('Board');
    expect(created.type).toBe('board');

    const updated = await jsonOf<ViewBody>(
      await call(`/database-views/${created.id}`, {
        method: 'PATCH',
        body: { name: 'Kanban' },
        userId,
      }),
    );

    expect(updated.name).toBe('Kanban');

    const views = await jsonOf<ViewBody[]>(
      await call(`/databases/${database.id}/views`, { userId }),
    );

    expect(views.map((view) => view.name)).toEqual(['Table', 'Kanban']);
  });

  it('protects the last view from deletion', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);
    const views = await jsonOf<ViewBody[]>(
      await call(`/databases/${database.id}/views`, { userId }),
    );

    const response = await call(`/database-views/${views[0]?.id}`, {
      method: 'DELETE',
      userId,
    });

    expect(response.status).toBe(404);
  });

  it('deletes a view when another one remains', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);
    const second = await jsonOf<ViewBody>(
      await call(`/databases/${database.id}/views`, {
        body: { databaseId: database.id, name: 'Calendar', type: 'calendar' },
        userId,
      }),
    );

    const removed = await call(`/database-views/${second.id}`, { method: 'DELETE', userId });

    expect(removed.status).toBe(204);
  });

  it('persists database metadata and every view setting', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const coverFileId = crypto.randomUUID();
    const properties = [
      { id: 'prop-1', name: 'Name', type: 'title' },
      { id: 'prop-2', name: 'Status', type: 'status' },
    ];

    const database = await jsonOf<DatabaseBody>(
      await call(`/workspaces/${workspace.id}/databases`, {
        body: { workspaceId: workspace.id, title: 'Projects', isInline: true, properties },
        userId,
      }),
    );

    const updated = await jsonOf<DatabaseBody>(
      await call(`/databases/${database.id}`, {
        method: 'PATCH',
        body: {
          title: 'Projects 2026',
          description: 'Everything in flight',
          icon: '🚀',
          coverFileId,
          properties,
          isTrashed: false,
        },
        userId,
      }),
    );

    expect(updated.title).toBe('Projects 2026');
    expect(updated.description).toBe('Everything in flight');
    expect(updated.icon).toBe('🚀');
    expect(updated.coverFileId).toBe(coverFileId);
    expect(updated.properties).toHaveLength(2);

    const view = await jsonOf<ViewBody>(
      await call(`/databases/${database.id}/views`, {
        body: {
          databaseId: database.id,
          name: 'Board',
          type: 'board',
          filter: { propertyId: 'prop-2', operator: 'is_not_empty' },
          sorts: [{ propertyId: 'prop-1', direction: 'ascending' }],
          groupBy: { propertyId: 'prop-2' },
          chart: { groupPropertyId: 'prop-2', valuePropertyId: null },
          visiblePropertyIds: ['prop-1', 'prop-2'],
        },
        userId,
      }),
    );

    expect(view.filter).toEqual({ propertyId: 'prop-2', operator: 'is_not_empty' });
    expect(view.groupBy?.propertyId).toBe('prop-2');
    expect(view.chart?.groupPropertyId).toBe('prop-2');
    expect(view.visiblePropertyIds).toEqual(['prop-1', 'prop-2']);

    const configured = await jsonOf<ViewBody>(
      await call(`/database-views/${view.id}`, {
        method: 'PATCH',
        body: {
          name: 'Board 2026',
          type: 'board',
          filter: null,
          sorts: [{ propertyId: 'prop-1', direction: 'descending' }],
          groupBy: null,
          chart: null,
          visiblePropertyIds: ['prop-1'],
          columnWidths: { 'prop-1': 240 },
          aggregations: [{ propertyId: 'prop-1', calculation: 'count_all' }],
        },
        userId,
      }),
    );

    expect(configured.name).toBe('Board 2026');
    expect(configured.columnWidths).toEqual({ 'prop-1': 240 });
    expect(configured.aggregations).toEqual([{ propertyId: 'prop-1', calculation: 'count_all' }]);
  });

  it('rejects an empty view update', async () => {
    const userId = OWNER();
    const workspace = await createWorkspace(userId);
    const database = await createDatabase(userId, workspace.id);
    const views = await jsonOf<ViewBody[]>(
      await call(`/databases/${database.id}/views`, { userId }),
    );

    const response = await call(`/database-views/${views[0]?.id}`, {
      method: 'PATCH',
      body: {},
      userId,
    });

    expect(response.status).toBe(400);
  });
});
