import { z } from 'zod';
import { PageSchema } from './page';
import { IdSchema, IsoDateTimeSchema } from './ids';

/**
 * События домена для асинхронной обработки (Queues).
 * Поисковый индекс, вебхуки и очистка подписываются на эти типы,
 * поэтому payload здесь, а не в потребителе.
 */
export const PageEventBaseSchema = z.object({
  /** Идентификатор события: дедупликация на стороне потребителя. */
  id: IdSchema,
  occurredAt: IsoDateTimeSchema,
  workspaceId: IdSchema,
  pageId: IdSchema,
  actorId: IdSchema.nullable(),
});

export const PageEventSchema = z.discriminatedUnion('type', [
  PageEventBaseSchema.extend({
    type: z.literal('page.created'),
    payload: z.object({ page: PageSchema }),
  }),
  PageEventBaseSchema.extend({
    type: z.literal('page.updated'),
    payload: z.object({
      page: PageSchema,
      changedFields: z.array(z.string()).min(1),
    }),
  }),
  PageEventBaseSchema.extend({
    type: z.literal('page.deleted'),
    payload: z.object({
      /** true — страница ушла в корзину, false — восстановлена. */
      trashed: z.boolean(),
    }),
  }),
  PageEventBaseSchema.extend({
    type: z.literal('page.moved'),
    payload: z.object({
      parentId: IdSchema.nullable(),
      position: z.string().min(1),
    }),
  }),
]);

export type PageEvent = z.infer<typeof PageEventSchema>;
export type PageEventType = PageEvent['type'];

export const PAGE_EVENT_TYPES = [
  'page.created',
  'page.updated',
  'page.deleted',
  'page.moved',
] as const satisfies readonly PageEventType[];

export type CreatePageEventInput = z.input<typeof PageEventSchema>;
