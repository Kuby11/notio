import type {
  CreateDatabaseInput,
  CreateRowInput,
  CreateViewInput,
  Database,
  DatabaseRow,
  DatabaseView,
  UpdateDatabaseInput,
  UpdateRowInput,
  UpdateViewInput,
} from '@notio/contracts';
import {
  createDefaultDatabase,
  DatabaseRowSchema,
  DatabaseSchema,
  DatabaseViewSchema,
  newId,
} from '@notio/contracts';
import { env } from '../../../shared/configs/env';
import { HttpError, type TokenProvider } from '../../../shared/types';
import type { DatabaseRepository } from '../types/ports';

/**
 * In-memory fallback storage for databases, views and rows (used in dev/preview/tests).
 */
const inMemoryDatabases = new Map<string, Database>();
const inMemoryViews = new Map<string, DatabaseView[]>();
const inMemoryRows = new Map<string, DatabaseRow[]>();

const isTest = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

const STORAGE_KEY = 'notio.databases.v1';

interface StoredDatabases {
  databases: Database[];
  views: Record<string, DatabaseView[]>;
  rows: Record<string, DatabaseRow[]>;
}

let hydrated = false;

/** localStorage is absent during SSR and may be blocked by the browser. */
function browserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * The database feature is local-first while the gateway has no database
 * endpoints. Without this cache a reload wiped every created database, and
 * even though the page still stored its databaseId the sidebar tree had no
 * row to show. Invalid JSON is ignored rather than breaking the app.
 */
function hydrateStore(): void {
  if (hydrated) {
    return;
  }

  hydrated = true;
  const storage = browserStorage();

  if (!storage) {
    return;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);

    if (!raw) {
      return;
    }

    const parsed = JSON.parse(raw) as Partial<StoredDatabases>;

    for (const item of parsed.databases ?? []) {
      const result = DatabaseSchema.safeParse(item);

      if (result.success) {
        inMemoryDatabases.set(result.data.id, result.data);
      }
    }

    for (const [databaseId, views] of Object.entries(parsed.views ?? {})) {
      if (!Array.isArray(views)) {
        continue;
      }

      const valid: DatabaseView[] = [];

      for (const view of views) {
        const result = DatabaseViewSchema.safeParse(view);

        if (result.success) {
          valid.push(result.data);
        }
      }

      inMemoryViews.set(databaseId, valid);
    }

    for (const [databaseId, rows] of Object.entries(parsed.rows ?? {})) {
      if (!Array.isArray(rows)) {
        continue;
      }

      const valid: DatabaseRow[] = [];

      for (const row of rows) {
        const result = DatabaseRowSchema.safeParse(row);

        if (result.success) {
          valid.push(result.data);
        }
      }

      inMemoryRows.set(databaseId, valid);
    }
  } catch {
    // A corrupted cache is disposable; the page can recreate its database.
  }
}

function persistStore(): void {
  const storage = browserStorage();

  if (!storage) {
    return;
  }

  try {
    const payload: StoredDatabases = {
      databases: [...inMemoryDatabases.values()],
      views: Object.fromEntries(inMemoryViews),
      rows: Object.fromEntries(inMemoryRows),
    };

    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota or a privacy mode without writes: keep the session state only.
  }
}

export function createDatabaseRepositoryApi(accessToken: TokenProvider): DatabaseRepository {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await accessToken.execute();
    if (token === null) {
      throw new HttpError(401, 'Authorization required');
    }
    return {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    };
  }

  return {
    async get(id: string): Promise<Database> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/databases/${id}`, { headers });
          if (response.ok) {
            return DatabaseSchema.parse(await response.json());
          }
        } catch {
          // Fall back to in-memory store
        }
      }

      const existing = inMemoryDatabases.get(id);
      if (existing) {
        return existing;
      }

      // If not found, generate a starter database
      const starter = createDefaultDatabase('workspace-default', 'Project Tasks');
      starter.database.id = id;
      inMemoryDatabases.set(id, starter.database);
      inMemoryViews.set(id, starter.defaultViews);
      inMemoryRows.set(id, starter.defaultRows);
      persistStore();
      return starter.database;
    },

    async list(workspaceId: string): Promise<Database[]> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/workspaces/${workspaceId}/databases`, {
            headers,
          });
          if (response.ok) {
            const list = (await response.json()) as unknown[];
            return list.map((item) => DatabaseSchema.parse(item));
          }
        } catch {
          // Fallback
        }
      }

      const results: Database[] = [];
      for (const db of inMemoryDatabases.values()) {
        if (db.workspaceId === workspaceId && !db.isTrashed) {
          results.push(db);
        }
      }
      return results;
    },

    async create(input: CreateDatabaseInput): Promise<Database> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/workspaces/${input.workspaceId}/databases`, {
            method: 'POST',
            headers,
            body: JSON.stringify(input),
          });
          if (response.ok) {
            return DatabaseSchema.parse(await response.json());
          }
        } catch {
          // Fallback
        }
      }

      const starter = createDefaultDatabase(input.workspaceId, input.title, input.isInline);
      if (input.properties) {
        starter.database.properties = input.properties;
      }
      starter.database.parentId = input.parentId;
      inMemoryDatabases.set(starter.database.id, starter.database);
      inMemoryViews.set(starter.database.id, starter.defaultViews);
      inMemoryRows.set(starter.database.id, starter.defaultRows);
      persistStore();
      return starter.database;
    },

    async update(id: string, input: UpdateDatabaseInput): Promise<Database> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/databases/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(input),
          });
          if (response.ok) {
            return DatabaseSchema.parse(await response.json());
          }
        } catch {
          // Fallback
        }
      }

      const existing = inMemoryDatabases.get(id);
      if (!existing) {
        throw new HttpError(404, 'Database not found');
      }

      const updated: Database = {
        ...existing,
        ...input,
        description:
          input.description !== undefined ? (input.description ?? undefined) : existing.description,
        icon: input.icon !== undefined ? (input.icon ?? undefined) : existing.icon,
        coverFileId:
          input.coverFileId !== undefined ? (input.coverFileId ?? undefined) : existing.coverFileId,
        updatedAt: new Date().toISOString(),
      };
      inMemoryDatabases.set(id, updated);
      persistStore();
      return updated;
    },

    async getRows(databaseId: string): Promise<DatabaseRow[]> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/databases/${databaseId}/rows`, { headers });
          if (response.ok) {
            const list = (await response.json()) as unknown[];
            return list.map((item) => DatabaseRowSchema.parse(item));
          }
        } catch {
          // Fallback
        }
      }

      return inMemoryRows.get(databaseId) ?? [];
    },

    async createRow(input: CreateRowInput): Promise<DatabaseRow> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/databases/${input.databaseId}/rows`, {
            method: 'POST',
            headers,
            body: JSON.stringify(input),
          });
          if (response.ok) {
            return DatabaseRowSchema.parse(await response.json());
          }
        } catch {
          // Fallback
        }
      }

      const now = new Date().toISOString();
      const newRow: DatabaseRow = {
        id: newId(),
        databaseId: input.databaseId,
        workspaceId: 'workspace-default',
        title: input.title,
        properties: input.properties ?? {},
        isTrashed: false,
        createdBy: 'user-default',
        createdAt: now,
        updatedAt: now,
      };

      const existing = inMemoryRows.get(input.databaseId) ?? [];
      inMemoryRows.set(input.databaseId, [...existing, newRow]);
      persistStore();
      return newRow;
    },

    async updateRow(id: string, input: UpdateRowInput): Promise<DatabaseRow> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/database-rows/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(input),
          });
          if (response.ok) {
            return DatabaseRowSchema.parse(await response.json());
          }
        } catch {
          // Fallback
        }
      }

      for (const [dbId, rows] of inMemoryRows.entries()) {
        const current = rows.find((r) => r.id === id);

        if (current) {
          const updated: DatabaseRow = {
            id: current.id,
            databaseId: current.databaseId,
            workspaceId: current.workspaceId,
            createdBy: current.createdBy,
            createdAt: current.createdAt,
            title: input.title !== undefined ? input.title : current.title,
            properties:
              input.properties !== undefined
                ? { ...current.properties, ...input.properties }
                : current.properties,
            isTrashed: input.isTrashed !== undefined ? input.isTrashed : current.isTrashed,
            updatedAt: new Date().toISOString(),
          };
          // Replace, never mutate: the query cache may hold the same array.
          inMemoryRows.set(
            dbId,
            rows.map((row) => (row.id === id ? updated : row)),
          );
          persistStore();
          return updated;
        }
      }

      throw new HttpError(404, 'Row not found');
    },

    async deleteRow(id: string): Promise<void> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/database-rows/${id}`, {
            method: 'DELETE',
            headers,
          });
          if (response.ok) return;
        } catch {
          // Fallback
        }
      }

      for (const [dbId, rows] of inMemoryRows.entries()) {
        const filtered = rows.filter((r) => r.id !== id);
        if (filtered.length !== rows.length) {
          inMemoryRows.set(dbId, filtered);
          persistStore();
          return;
        }
      }
    },

    async getViews(databaseId: string): Promise<DatabaseView[]> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/databases/${databaseId}/views`, { headers });
          if (response.ok) {
            const list = (await response.json()) as unknown[];
            return list.map((item) => DatabaseViewSchema.parse(item));
          }
        } catch {
          // Fallback
        }
      }

      return inMemoryViews.get(databaseId) ?? [];
    },

    async createView(input: CreateViewInput): Promise<DatabaseView> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/databases/${input.databaseId}/views`, {
            method: 'POST',
            headers,
            body: JSON.stringify(input),
          });
          if (response.ok) {
            return DatabaseViewSchema.parse(await response.json());
          }
        } catch {
          // Fallback
        }
      }

      const newView: DatabaseView = {
        id: newId(),
        databaseId: input.databaseId,
        name: input.name,
        type: input.type,
        filter: input.filter,
        sorts: input.sorts ?? [],
        groupBy: input.groupBy,
        chart: input.chart,
        visiblePropertyIds: input.visiblePropertyIds ?? ['title'],
      };

      const existing = inMemoryViews.get(input.databaseId) ?? [];
      inMemoryViews.set(input.databaseId, [...existing, newView]);
      persistStore();
      return newView;
    },

    async updateView(id: string, input: UpdateViewInput): Promise<DatabaseView> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/database-views/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(input),
          });
          if (response.ok) {
            return DatabaseViewSchema.parse(await response.json());
          }
        } catch {
          // Fallback
        }
      }

      for (const [dbId, views] of inMemoryViews.entries()) {
        const current = views.find((v) => v.id === id);

        if (current) {
          const updated: DatabaseView = {
            id: current.id,
            databaseId: current.databaseId,
            name: input.name ?? current.name,
            type: input.type ?? current.type,
            filter: input.filter !== undefined ? (input.filter ?? undefined) : current.filter,
            sorts: input.sorts ?? current.sorts,
            groupBy: input.groupBy !== undefined ? (input.groupBy ?? undefined) : current.groupBy,
            chart: input.chart !== undefined ? (input.chart ?? undefined) : current.chart,
            visiblePropertyIds: input.visiblePropertyIds ?? current.visiblePropertyIds,
            columnWidths: input.columnWidths ?? current.columnWidths,
            aggregations: input.aggregations ?? current.aggregations,
          };
          // Replace, never mutate: the query cache may hold the same array.
          inMemoryViews.set(
            dbId,
            views.map((view) => (view.id === id ? updated : view)),
          );
          persistStore();
          return updated;
        }
      }

      throw new HttpError(404, 'View not found');
    },

    async deleteView(id: string): Promise<void> {
      hydrateStore();

      if (!isTest) {
        try {
          const headers = await authHeaders();
          const response = await fetch(`${baseUrl}/api/database-views/${id}`, {
            method: 'DELETE',
            headers,
          });
          if (response.ok) return;
        } catch {
          // Fallback
        }
      }

      for (const [dbId, views] of inMemoryViews.entries()) {
        const filtered = views.filter((v) => v.id !== id);
        if (filtered.length !== views.length) {
          inMemoryViews.set(dbId, filtered);
          persistStore();
          return;
        }
      }
    },
  };
}
