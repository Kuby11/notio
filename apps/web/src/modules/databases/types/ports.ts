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

/**
 * Port for database operations (Clean Architecture).
 * Implemented by database.api.ts.
 */
export interface DatabaseRepository {
  get(id: string): Promise<Database>;
  list(workspaceId: string): Promise<Database[]>;
  create(input: CreateDatabaseInput): Promise<Database>;
  update(id: string, input: UpdateDatabaseInput): Promise<Database>;
  getRows(databaseId: string): Promise<DatabaseRow[]>;
  createRow(input: CreateRowInput): Promise<DatabaseRow>;
  updateRow(id: string, input: UpdateRowInput): Promise<DatabaseRow>;
  deleteRow(id: string): Promise<void>;
  getViews(databaseId: string): Promise<DatabaseView[]>;
  createView(input: CreateViewInput): Promise<DatabaseView>;
  updateView(id: string, input: UpdateViewInput): Promise<DatabaseView>;
  deleteView(id: string): Promise<void>;
}
