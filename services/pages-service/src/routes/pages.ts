import {
  CreatePageInputSchema,
  IdSchema,
  INTERNAL_HEADERS,
  PageListQuerySchema,
  PageListResultSchema,
  PageSchema,
  toProblemErrors,
  UpdatePageInputSchema,
} from '@notio/contracts';
import type { z } from 'zod';
import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../env';
import { ValidationError } from '../errors';
import { requireActorId, type PageService } from '../services/page.service';

/**
 * Сценарий создаётся на каждый запрос: в Workers биндинги приходят в `env`,
 * поэтому сервис нельзя построить один раз при старте приложения.
 * Фабрика позволяет подменить часы в тестах.
 */
export type PageServiceFactory = (env: Bindings) => PageService;

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

  return routes;
}
