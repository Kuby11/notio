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
import { createDefaultDatabase, newId } from '@notio/contracts';
import { HttpError } from '../src/shared/types';
import type { DatabaseRepository } from '../src/modules/databases';

/**
 * In-memory `DatabaseRepository` for tests.
 *
 * The production adapter is a strict HTTP client, so tests that exercise the
 * databases UI inject this double through `renderWithProviders`. It keeps the
 * convenience the old production fallback had — an unknown id resolves to a
 * seeded "Project Tasks" database — but only inside tests.
 */
export function createFakeDatabaseRepository(): DatabaseRepository {
  const databases = new Map<string, Database>();
  const views = new Map<string, DatabaseView[]>();
  const rows = new Map<string, DatabaseRow[]>();

  function seed(input: CreateDatabaseInput): Database {
    const starter = createDefaultDatabase(input.workspaceId, input.title, input.isInline);

    starter.database.parentId = input.parentId;

    if (input.properties) {
      starter.database.properties = input.properties;
    }

    databases.set(starter.database.id, starter.database);
    views.set(starter.database.id, starter.defaultViews);
    rows.set(starter.database.id, starter.defaultRows);

    return starter.database;
  }

  return {
    async get(id: string): Promise<Database> {
      const existing = databases.get(id);

      if (existing) {
        return existing;
      }

      const starter = createDefaultDatabase('workspace-default', 'Project Tasks');
      starter.database.id = id;
      databases.set(id, starter.database);
      views.set(id, starter.defaultViews);
      rows.set(id, starter.defaultRows);

      return starter.database;
    },

    async list(workspaceId: string): Promise<Database[]> {
      return [...databases.values()].filter(
        (database) => database.workspaceId === workspaceId && !database.isTrashed,
      );
    },

    async create(input: CreateDatabaseInput): Promise<Database> {
      return seed(input);
    },

    async update(id: string, input: UpdateDatabaseInput): Promise<Database> {
      const existing = databases.get(id);

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

      databases.set(id, updated);

      return updated;
    },

    async getRows(databaseId: string): Promise<DatabaseRow[]> {
      return rows.get(databaseId) ?? [];
    },

    async createRow(input: CreateRowInput): Promise<DatabaseRow> {
      const now = new Date().toISOString();
      const created: DatabaseRow = {
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

      rows.set(input.databaseId, [...(rows.get(input.databaseId) ?? []), created]);

      return created;
    },

    async updateRow(id: string, input: UpdateRowInput): Promise<DatabaseRow> {
      for (const [databaseId, list] of rows) {
        const current = list.find((row) => row.id === id);

        if (!current) {
          continue;
        }

        const updated: DatabaseRow = {
          ...current,
          title: input.title !== undefined ? input.title : current.title,
          properties:
            input.properties !== undefined
              ? { ...current.properties, ...input.properties }
              : current.properties,
          isTrashed: input.isTrashed !== undefined ? input.isTrashed : current.isTrashed,
          updatedAt: new Date().toISOString(),
        };

        rows.set(
          databaseId,
          list.map((row) => (row.id === id ? updated : row)),
        );

        return updated;
      }

      throw new HttpError(404, 'Row not found');
    },

    async deleteRow(id: string): Promise<void> {
      for (const [databaseId, list] of rows) {
        rows.set(
          databaseId,
          list.filter((row) => row.id !== id),
        );
      }
    },

    async getViews(databaseId: string): Promise<DatabaseView[]> {
      return views.get(databaseId) ?? [];
    },

    async createView(input: CreateViewInput): Promise<DatabaseView> {
      const created: DatabaseView = {
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

      views.set(input.databaseId, [...(views.get(input.databaseId) ?? []), created]);

      return created;
    },

    async updateView(id: string, input: UpdateViewInput): Promise<DatabaseView> {
      for (const [databaseId, list] of views) {
        const current = list.find((view) => view.id === id);

        if (!current) {
          continue;
        }

        const updated: DatabaseView = {
          ...current,
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

        views.set(
          databaseId,
          list.map((view) => (view.id === id ? updated : view)),
        );

        return updated;
      }

      throw new HttpError(404, 'View not found');
    },

    async deleteView(id: string): Promise<void> {
      for (const [databaseId, list] of views) {
        views.set(
          databaseId,
          list.filter((view) => view.id !== id),
        );
      }
    },
  };
}
