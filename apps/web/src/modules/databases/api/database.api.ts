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
import { DatabaseRowSchema, DatabaseSchema, DatabaseViewSchema } from '@notio/contracts';
import { env } from '../../../shared/configs/env';
import { HttpError, type TokenProvider } from '../../../shared/types';
import type { DatabaseRepository } from '../types/ports';

/**
 * HTTP adapter for the databases port.
 *
 * This adapter is strict on purpose. It previously carried an in-memory store
 * with a `localStorage` cache and seeded starter rows: every browser saw the
 * same fake workspace, and databases created by one account were readable by
 * another on the same machine. Nothing is cached or invented here — a failed
 * request is reported to the caller, which shows the error and a retry. Tests
 * inject their own in-memory repository (see test/database-fixture.ts).
 */

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const DEFAULT_ERROR_MESSAGE = 'Database request failed';

/**
 * Turns a non-2xx response into a typed error carrying the status, so hooks can
 * distinguish "signed out" from "not found" instead of silently succeeding.
 */
async function toHttpError(response: Response): Promise<HttpError> {
  let message = DEFAULT_ERROR_MESSAGE;

  try {
    const body: unknown = await response.json();

    if (typeof body === 'object' && body !== null) {
      const candidate = body as { message?: unknown; title?: unknown; detail?: unknown };

      for (const value of [candidate.message, candidate.title, candidate.detail]) {
        if (typeof value === 'string' && value.trim().length > 0) {
          message = value;
          break;
        }
      }
    }
  } catch {
    // A body is optional: the status alone is enough to report the failure.
  }

  return new HttpError(response.status, message);
}

/** Validates a list response item by item instead of trusting its shape. */
function parseList<T>(value: unknown, schema: { parse: (input: unknown) => T }): T[] {
  if (!Array.isArray(value)) {
    throw new HttpError(502, 'Unexpected response from the database service');
  }

  return value.map((item) => schema.parse(item));
}

export function createDatabaseRepositoryApi(accessToken: TokenProvider): DatabaseRepository {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function request(
    path: string,
    method: HttpMethod = 'GET',
    body?: unknown,
  ): Promise<unknown> {
    const token = await accessToken.execute();

    if (token === null) {
      throw new HttpError(401, 'Authorization required');
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      throw await toHttpError(response);
    }

    // 204 is a valid answer for deletions.
    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  return {
    async get(id: string): Promise<Database> {
      return DatabaseSchema.parse(await request(`/api/databases/${encodeURIComponent(id)}`));
    },

    async list(workspaceId: string): Promise<Database[]> {
      return parseList(
        await request(`/api/workspaces/${encodeURIComponent(workspaceId)}/databases`),
        DatabaseSchema,
      );
    },

    async create(input: CreateDatabaseInput): Promise<Database> {
      return DatabaseSchema.parse(
        await request(
          `/api/workspaces/${encodeURIComponent(input.workspaceId)}/databases`,
          'POST',
          input,
        ),
      );
    },

    async update(id: string, input: UpdateDatabaseInput): Promise<Database> {
      return DatabaseSchema.parse(
        await request(`/api/databases/${encodeURIComponent(id)}`, 'PATCH', input),
      );
    },

    async getRows(databaseId: string): Promise<DatabaseRow[]> {
      return parseList(
        await request(`/api/databases/${encodeURIComponent(databaseId)}/rows`),
        DatabaseRowSchema,
      );
    },

    async createRow(input: CreateRowInput): Promise<DatabaseRow> {
      return DatabaseRowSchema.parse(
        await request(`/api/databases/${encodeURIComponent(input.databaseId)}/rows`, 'POST', input),
      );
    },

    async updateRow(id: string, input: UpdateRowInput): Promise<DatabaseRow> {
      return DatabaseRowSchema.parse(
        await request(`/api/database-rows/${encodeURIComponent(id)}`, 'PATCH', input),
      );
    },

    async deleteRow(id: string): Promise<void> {
      await request(`/api/database-rows/${encodeURIComponent(id)}`, 'DELETE');
    },

    async getViews(databaseId: string): Promise<DatabaseView[]> {
      return parseList(
        await request(`/api/databases/${encodeURIComponent(databaseId)}/views`),
        DatabaseViewSchema,
      );
    },

    async createView(input: CreateViewInput): Promise<DatabaseView> {
      return DatabaseViewSchema.parse(
        await request(
          `/api/databases/${encodeURIComponent(input.databaseId)}/views`,
          'POST',
          input,
        ),
      );
    },

    async updateView(id: string, input: UpdateViewInput): Promise<DatabaseView> {
      return DatabaseViewSchema.parse(
        await request(`/api/database-views/${encodeURIComponent(id)}`, 'PATCH', input),
      );
    },

    async deleteView(id: string): Promise<void> {
      await request(`/api/database-views/${encodeURIComponent(id)}`, 'DELETE');
    },
  };
}
