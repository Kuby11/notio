import {
  BlockListResultSchema,
  BlockSchema,
  CreateBlockInputSchema,
  CreatePageInputSchema,
  IdSchema,
  INTERNAL_HEADERS,
  MoveBlockInputSchema,
  MovePageInputSchema,
  PageFavoritesQuerySchema,
  PageListQuerySchema,
  PageListResultSchema,
  PageSchema,
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
 * Сценарий создаётся на каждый запрос: в Workers биндинги приходят в `env`,
 * поэтому сервис нельзя построить один раз при старте приложения.
 * Фабрика позволяет подменить часы в тестах.
 */
export type PageServiceFactory = (env: Bindings) => PageService;
export type BlockServiceFactory = (env: Bindings) => BlockService;

/** Разбирает вход по схеме; ошибки Zod превращает в список полей problem details. */
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
 * Маршруты страниц. Здесь и только здесь живёт HTTP: валидация входа,
 * вызов сценария и сборка ответа по контракту из packages/contracts.
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

  // Статические маршруты объявлены до `/pages/:id`: иначе Hono попробует
  // разобрать «favorites» или «trash» как UUID и вернёт 400 вместо списка.
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

  routes.post('/pages/:id/move', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const workspaceId = parseOrThrow(IdSchema, c.req.query('workspaceId'));
    const input = parseOrThrow(MovePageInputSchema, await readJsonBody(c.req.raw));

    // Идентичность проверяется, чтобы запись не уходила от анонима,
    // хотя сама страница не хранит её в новой позиции.
    requireActorId(c.req.header(INTERNAL_HEADERS.ACTOR_ID));

    const page = await createService(c.env).movePage(id, workspaceId, input);

    return c.json(PageSchema.parse(page), 200);
  });

  // Блоки страницы.
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

  // Версионирование страниц.
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
