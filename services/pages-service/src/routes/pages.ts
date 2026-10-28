import {
  BlockListResultSchema,
  BlockSchema,
  CreateBlockInputSchema,
  CreatePageInputSchema,
  IdSchema,
  INTERNAL_HEADERS,
  MoveBlockInputSchema,
  MovePageInputSchema,
  PageAllQuerySchema,
  PageFavoritesQuerySchema,
  PageListQuerySchema,
  PageListResultSchema,
  PageSchema,
  PageSearchQuerySchema,
  PageTrashQuerySchema,
  PageVersionSchema,
  toProblemErrors,
  UpdateBlockInputSchema,
  UpdatePageInputSchema,
} from '@notio/contracts';
import type { z } from 'zod';
import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../env';
import { NotFoundError, ValidationError } from '../errors';
import { requireActorId, type PageService } from '../services/page.service';
import { createBlockService, type BlockService } from '../services/block.service';
import { createPageVersionService } from '../services/page-version.service';

/**
 * The scenario is created per request: in Workers bindings arrive in `env`,
 * so the service cannot be built once at application start.
 * The factory lets tests substitute the clock.
 */
export type PageServiceFactory = (env: Bindings) => PageService;
export type BlockServiceFactory = (env: Bindings) => BlockService;

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

/**
 * Page routes. HTTP lives here and only here: input validation, calling the
 * scenario and building the response to the contract in packages/contracts.
 */
export function createPageRoutes(createService: PageServiceFactory): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.post('/pages', async (c) => {
    const input = parseOrThrow(CreatePageInputSchema, await readJsonBody(c.req.raw));
    const actorId = requireActorId(c.req.header(INTERNAL_HEADERS.ACTOR_ID));

    const page = await createService(c.env).createPage(input, actorId);

    return c.json(PageSchema.parse(page), 201);
  });

  routes.get('/pages', async (c) => {
    const query = parseOrThrow(PageListQuerySchema, c.req.query());
    const result = await createService(c.env).listChildren(query);

    return c.json(PageListResultSchema.parse(result), 200);
  });

  // Static routes are declared before `/pages/:id`: otherwise Hono would try to
  // parse "favorites" or "trash" as a UUID and return 400 instead of a list.
  routes.get('/pages/favorites', async (c) => {
    const query = parseOrThrow(PageFavoritesQuerySchema, c.req.query());
    const result = await createService(c.env).listFavorites(query);

    return c.json(PageListResultSchema.parse(result), 200);
  });

  routes.get('/pages/trash', async (c) => {
    const query = parseOrThrow(PageTrashQuerySchema, c.req.query());
    const result = await createService(c.env).listTrashed(query);

    return c.json(PageListResultSchema.parse(result), 200);
  });

  // Like favorites and trash, the flat list is declared before `/pages/:id`:
  // "all" is not a UUID, and Hono must not try to parse it as one.
  routes.get('/pages/all', async (c) => {
    const query = parseOrThrow(PageAllQuerySchema, c.req.query());
    const result = await createService(c.env).listAll(query);

    return c.json(PageListResultSchema.parse(result), 200);
  });

  // Like favorites and trash, search is declared before `/pages/:id`: "search"
  // is not a UUID, and Hono must not try to parse it as one.
  routes.get('/pages/search', async (c) => {
    const query = parseOrThrow(PageSearchQuerySchema, c.req.query());
    const result = await createService(c.env).searchPages(query);

    return c.json(PageListResultSchema.parse(result), 200);
  });

  routes.get('/pages/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const page = await createService(c.env).getPage(id, c.req.query('workspaceId'));

    return c.json(PageSchema.parse(page), 200);
  });

  routes.patch('/pages/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const workspaceId = parseOrThrow(IdSchema, c.req.query('workspaceId'));
    const patch = parseOrThrow(UpdatePageInputSchema, await readJsonBody(c.req.raw));

    const page = await createService(c.env).updatePage(id, workspaceId, patch);

    return c.json(PageSchema.parse(page), 200);
  });

  routes.post('/pages/:id/duplicate', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const actorId = requireActorId(c.req.header(INTERNAL_HEADERS.ACTOR_ID));

    const page = await createService(c.env).duplicatePage(id, actorId);

    return c.json(PageSchema.parse(page), 201);
  });

  routes.post('/pages/:id/move', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const workspaceId = parseOrThrow(IdSchema, c.req.query('workspaceId'));
    const input = parseOrThrow(MovePageInputSchema, await readJsonBody(c.req.raw));

    // Identity is checked so a write never happens as an anonymous user,
    // even though the page row does not store it in the new position.
    requireActorId(c.req.header(INTERNAL_HEADERS.ACTOR_ID));

    const page = await createService(c.env).movePage(id, workspaceId, input);

    return c.json(PageSchema.parse(page), 200);
  });

  routes.get('/pages/:pageId/blocks', async (c) => {
    const pageId = parseOrThrow(IdSchema, c.req.param('pageId'));
    const items = await createBlockService(c.env).getPageBlocks(pageId);

    return c.json(BlockListResultSchema.parse({ items, nextCursor: null }), 200);
  });

  routes.post('/blocks', async (c) => {
    const input = parseOrThrow(CreateBlockInputSchema, await readJsonBody(c.req.raw));
    const actorId = requireActorId(c.req.header(INTERNAL_HEADERS.ACTOR_ID));

    const block = await createBlockService(c.env).createBlock(input, actorId);

    return c.json(BlockSchema.parse(block), 201);
  });

  routes.patch('/blocks/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const patch = parseOrThrow(UpdateBlockInputSchema, await readJsonBody(c.req.raw));

    const block = await createBlockService(c.env).updateBlock(id, patch);

    return c.json(BlockSchema.parse(block), 200);
  });

  routes.delete('/blocks/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    await createBlockService(c.env).deleteBlock(id);

    return c.body(null, 204);
  });

  routes.post('/blocks/:id/move', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(MoveBlockInputSchema, await readJsonBody(c.req.raw));

    const block = await createBlockService(c.env).moveBlock(id, input.afterBlockId);

    return c.json(BlockSchema.parse(block), 200);
  });

  routes.post('/pages/:pageId/versions', async (c) => {
    const pageId = parseOrThrow(IdSchema, c.req.param('pageId'));
    const actorId = requireActorId(c.req.header(INTERNAL_HEADERS.ACTOR_ID));

    const version = await createPageVersionService(c.env).createSnapshot(pageId, actorId);

    return c.json(PageVersionSchema.parse(version), 201);
  });

  routes.get('/pages/:pageId/versions', async (c) => {
    const pageId = parseOrThrow(IdSchema, c.req.param('pageId'));

    const versions = await createPageVersionService(c.env).listVersions(pageId);

    return c.json({ items: versions }, 200);
  });

  routes.get('/pages/:pageId/versions/:versionId', async (c) => {
    const versionId = parseOrThrow(IdSchema, c.req.param('versionId'));
    const version = await createPageVersionService(c.env).getVersion(versionId);

    if (!version) {
      throw new NotFoundError('Версия не найдена');
    }

    return c.json(PageVersionSchema.parse(version), 200);
  });

  return routes;
}
