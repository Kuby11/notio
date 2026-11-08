import {
  newId,
  roleCan,
  type CreateDatabaseInput,
  type CreateRowInput,
  type CreateViewInput,
  type Database,
  type DatabaseRow,
  type DatabaseView,
  type UpdateDatabaseInput,
  type UpdateRowInput,
  type UpdateViewInput,
} from '@notio/contracts';
import { ForbiddenError, NotFoundError } from '../errors';
import { DatabaseRepository } from '../repositories/database.repository';
import { MemberRepository } from '../repositories/member.repository';
import type { Bindings } from '../env';

/** The time source is injected so tests do not depend on the system clock. */
export type Clock = () => Date;

/**
 * Database scenarios: Notion-like databases with rows and views.
 *
 * Access control mirrors the workspace scenarios: the actor must be a member
 * of the workspace that owns the database (reads) and hold the write
 * permission for mutations. HTTP lives in the routes layer.
 */
export class DatabaseService {
  constructor(
    private readonly repo: DatabaseRepository,
    private readonly isMember: (workspaceId: string, actorId: string) => Promise<boolean>,
    private readonly canWrite: (workspaceId: string, actorId: string) => Promise<boolean>,
    private readonly clock: Clock = () => new Date(),
  ) {}

  private now(): string {
    return this.clock().toISOString();
  }

  private async assertReadable(workspaceId: string, actorId: string): Promise<void> {
    if (!(await this.isMember(workspaceId, actorId))) {
      throw new NotFoundError('Database not found');
    }
  }

  private async assertWritable(workspaceId: string, actorId: string): Promise<void> {
    if (!(await this.canWrite(workspaceId, actorId))) {
      throw new NotFoundError('Database not found');
    }
  }

  async create(actorId: string, input: CreateDatabaseInput): Promise<Database> {
    await this.assertWritable(input.workspaceId, actorId);

    const now = this.now();
    const databaseId = newId();
    const viewId = newId();

    // Every database starts with a single table view: the UI renders views
    // and cannot show an empty view list.
    await this.repo.insertView({
      id: viewId,
      databaseId,
      name: 'Table',
      type: 'table',
      visiblePropertyIds: [],
      createdAt: now,
      updatedAt: now,
    });

    await this.repo.insertDatabase({
      id: databaseId,
      workspaceId: input.workspaceId,
      parentId: input.parentId,
      title: input.title,
      isInline: input.isInline,
      properties: input.properties ?? [],
      defaultViewId: viewId,
      isTrashed: false,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    });

    return (await this.repo.findById(databaseId))!;
  }

  async get(id: string, actorId: string): Promise<Database> {
    const database = await this.repo.findById(id);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertReadable(database.workspaceId, actorId);

    return database;
  }

  async list(workspaceId: string, actorId: string): Promise<Database[]> {
    await this.assertReadable(workspaceId, actorId);

    return this.repo.listByWorkspace(workspaceId);
  }

  async update(id: string, actorId: string, input: UpdateDatabaseInput): Promise<Database> {
    const database = await this.repo.findById(id);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertWritable(database.workspaceId, actorId);

    const now = this.now();
    const updated = await this.repo.updateById(id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.coverFileId !== undefined ? { coverFileId: input.coverFileId } : {}),
      ...(input.properties !== undefined ? { properties: input.properties } : {}),
      ...(input.isTrashed !== undefined ? { isTrashed: input.isTrashed } : {}),
      updatedAt: now,
    });

    if (!updated) {
      throw new NotFoundError('Database not found');
    }

    return updated;
  }

  async getRows(databaseId: string, actorId: string): Promise<DatabaseRow[]> {
    const database = await this.repo.findById(databaseId);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertReadable(database.workspaceId, actorId);

    return this.repo.listRows(databaseId);
  }

  async createRow(actorId: string, input: CreateRowInput): Promise<DatabaseRow> {
    const database = await this.repo.findById(input.databaseId);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertWritable(database.workspaceId, actorId);

    const now = this.now();
    const row = {
      id: newId(),
      databaseId: database.id,
      workspaceId: database.workspaceId,
      title: input.title,
      properties: input.properties ?? {},
      isTrashed: false,
      createdBy: actorId,
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.insertRow(row);

    return (await this.repo.findRowById(row.id))!;
  }

  async updateRow(id: string, actorId: string, input: UpdateRowInput): Promise<DatabaseRow> {
    const row = await this.repo.findRowById(id);

    if (!row) {
      throw new NotFoundError('Row not found');
    }

    await this.assertWritable(row.workspaceId, actorId);

    const updated = await this.repo.updateRowById(id, {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.properties !== undefined ? { properties: input.properties } : {}),
      ...(input.isTrashed !== undefined ? { isTrashed: input.isTrashed } : {}),
      updatedAt: this.now(),
    });

    if (!updated) {
      throw new NotFoundError('Row not found');
    }

    return updated;
  }

  async deleteRow(id: string, actorId: string): Promise<void> {
    const row = await this.repo.findRowById(id);

    if (!row) {
      throw new NotFoundError('Row not found');
    }

    await this.assertWritable(row.workspaceId, actorId);

    await this.repo.deleteRowById(id);
  }

  async getViews(databaseId: string, actorId: string): Promise<DatabaseView[]> {
    const database = await this.repo.findById(databaseId);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertReadable(database.workspaceId, actorId);

    return this.repo.listViews(databaseId);
  }

  async createView(actorId: string, input: CreateViewInput): Promise<DatabaseView> {
    const database = await this.repo.findById(input.databaseId);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertWritable(database.workspaceId, actorId);

    const now = this.now();
    const view = {
      id: newId(),
      databaseId: database.id,
      name: input.name,
      type: input.type,
      filter: input.filter ?? null,
      sorts: input.sorts ?? null,
      groupBy: input.groupBy ?? null,
      chart: input.chart ?? null,
      visiblePropertyIds: input.visiblePropertyIds ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.insertView(view);

    return (await this.repo.findViewById(view.id))!;
  }

  async updateView(id: string, actorId: string, input: UpdateViewInput): Promise<DatabaseView> {
    const view = await this.repo.findViewById(id);

    if (!view) {
      throw new NotFoundError('View not found');
    }

    const database = await this.repo.findById(view.databaseId);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertWritable(database.workspaceId, actorId);

    const updated = await this.repo.updateViewById(id, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.filter !== undefined ? { filter: input.filter } : {}),
      ...(input.sorts !== undefined ? { sorts: input.sorts } : {}),
      ...(input.groupBy !== undefined ? { groupBy: input.groupBy } : {}),
      ...(input.chart !== undefined ? { chart: input.chart } : {}),
      ...(input.visiblePropertyIds !== undefined
        ? { visiblePropertyIds: input.visiblePropertyIds }
        : {}),
      ...(input.columnWidths !== undefined ? { columnWidths: input.columnWidths } : {}),
      ...(input.aggregations !== undefined ? { aggregations: input.aggregations } : {}),
      updatedAt: this.now(),
    });

    if (!updated) {
      throw new NotFoundError('View not found');
    }

    return updated;
  }

  async deleteView(id: string, actorId: string): Promise<void> {
    const view = await this.repo.findViewById(id);

    if (!view) {
      throw new NotFoundError('View not found');
    }

    const database = await this.repo.findById(view.databaseId);

    if (!database) {
      throw new NotFoundError('Database not found');
    }

    await this.assertWritable(database.workspaceId, actorId);

    const views = await this.repo.listViews(view.databaseId);

    // The last view cannot be deleted: the UI renders views exclusively.
    if (views.length <= 1) {
      throw new NotFoundError('The last view cannot be deleted');
    }

    await this.repo.deleteViewById(id);
  }
}

/** Builds the service over the worker bindings: repositories + membership checks. */
export function createDatabaseService(env: Bindings): DatabaseService {
  const members = new MemberRepository(env);

  const isMember = async (workspaceId: string, actorId: string): Promise<boolean> =>
    (await members.findRole(workspaceId, actorId)) !== null;

  const canWrite = async (workspaceId: string, actorId: string): Promise<boolean> => {
    const role = await members.findRole(workspaceId, actorId);

    return role !== null && roleCan(role, 'workspace:write');
  };

  return new DatabaseService(new DatabaseRepository(env), isMember, canWrite);
}

export function requireActorId(actorId: string | undefined | null): string {
  if (!actorId) {
    // Fail closed: no confirmed identity — no action.
    throw new ForbiddenError('Could not identify the user from the request context');
  }

  return actorId;
}
