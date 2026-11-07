import type { z } from 'zod';
import {
  CreateDatabaseInputSchema,
  CreateRowInputSchema,
  CreateViewInputSchema,
  DatabaseRowSchema,
  DatabaseSchema,
  DatabaseViewSchema,
  IdSchema,
  toProblemErrors,
  UpdateDatabaseInputSchema,
  UpdateRowInputSchema,
  UpdateViewInputSchema,
} from '@notio/contracts';
import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../env';
import { ValidationError } from '../errors';
import {
  createDatabaseService as buildDatabaseService,
  requireActorId,
  type DatabaseService,
} from '../services/database.service';

/**
 * Database routes. HTTP lives here and only here: input validation, parsing
 * the actor's identity and building the response to the contract.
 */
export type DatabaseServiceFactory = (env: Bindings) => DatabaseService;

/** Parses input against the schema; Zod errors become a problem details field list. */
function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError('Проверка данных не пройдена', {
      errors: toProblemErrors(result.error),
    });
  }

  return result.data;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('Тело запроса должно быть корректным JSON');
  }
}

function actorIdOf(c: { req: { header: (name: string) => string | undefined } }): string {
  return requireActorId(c.req.header('x-user-id'));
}

export function createDatabaseRoutes(
  createService: DatabaseServiceFactory = buildDatabaseService,
): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/workspaces/:workspaceId/databases', async (c) => {
    const workspaceId = parseOrThrow(IdSchema, c.req.param('workspaceId'));
    const items = await createService(c.env).list(workspaceId, actorIdOf(c));

    return c.json(items, 200);
  });

  routes.post('/workspaces/:workspaceId/databases', async (c) => {
    const input = parseOrThrow(CreateDatabaseInputSchema, await readJsonBody(c.req.raw));
    const database = await createService(c.env).create(actorIdOf(c), input);

    return c.json(DatabaseSchema.parse(database), 201);
  });

  routes.get('/databases/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const database = await createService(c.env).get(id, actorIdOf(c));

    return c.json(DatabaseSchema.parse(database), 200);
  });

  routes.patch('/databases/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(UpdateDatabaseInputSchema, await readJsonBody(c.req.raw));
    const database = await createService(c.env).update(id, actorIdOf(c), input);

    return c.json(DatabaseSchema.parse(database), 200);
  });

  routes.get('/databases/:id/rows', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const items = await createService(c.env).getRows(id, actorIdOf(c));

    return c.json(
      items.map((row) => DatabaseRowSchema.parse(row)),
      200,
    );
  });

  routes.post('/databases/:id/rows', async (c) => {
    const databaseId = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(CreateRowInputSchema, await readJsonBody(c.req.raw));
    const row = await createService(c.env).createRow(actorIdOf(c), {
      ...input,
      databaseId,
    });

    return c.json(DatabaseRowSchema.parse(row), 201);
  });

  routes.patch('/database-rows/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(UpdateRowInputSchema, await readJsonBody(c.req.raw));
    const row = await createService(c.env).updateRow(id, actorIdOf(c), input);

    return c.json(DatabaseRowSchema.parse(row), 200);
  });

  routes.delete('/database-rows/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));

    await createService(c.env).deleteRow(id, actorIdOf(c));

    return c.body(null, 204);
  });

  routes.get('/databases/:id/views', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const items = await createService(c.env).getViews(id, actorIdOf(c));

    return c.json(
      items.map((view) => DatabaseViewSchema.parse(view)),
      200,
    );
  });

  routes.post('/databases/:id/views', async (c) => {
    const databaseId = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(CreateViewInputSchema, await readJsonBody(c.req.raw));
    const view = await createService(c.env).createView(actorIdOf(c), {
      ...input,
      databaseId,
    });

    return c.json(DatabaseViewSchema.parse(view), 201);
  });

  routes.patch('/database-views/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(UpdateViewInputSchema, await readJsonBody(c.req.raw));
    const view = await createService(c.env).updateView(id, actorIdOf(c), input);

    return c.json(DatabaseViewSchema.parse(view), 200);
  });

  routes.delete('/database-views/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));

    await createService(c.env).deleteView(id, actorIdOf(c));

    return c.body(null, 204);
  });

  return routes;
}

export type { Bindings };
