import { z } from 'zod';
import { PageSchema } from './page';
import { WorkspaceRoleSchema, WorkspaceSchema } from './workspace';
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

/**
 * События рабочих пространств и участников.
 * Их потребители появятся вместе с realtime и поиском: подписка на события
 * не должна зависеть от того, кто их публикует.
 */
export const WorkspaceEventBaseSchema = z.object({
  id: IdSchema,
  occurredAt: IsoDateTimeSchema,
  workspaceId: IdSchema,
  actorId: IdSchema.nullable(),
});

export const WorkspaceEventSchema = z.discriminatedUnion('type', [
  WorkspaceEventBaseSchema.extend({
    type: z.literal('workspace.created'),
    payload: z.object({ workspace: WorkspaceSchema }),
  }),
  WorkspaceEventBaseSchema.extend({
    type: z.literal('workspace.archived'),
    payload: z.object({ archivedAt: IsoDateTimeSchema }),
  }),
  WorkspaceEventBaseSchema.extend({
    type: z.literal('member.joined'),
    payload: z.object({ userId: IdSchema, role: WorkspaceRoleSchema }),
  }),
  WorkspaceEventBaseSchema.extend({
    type: z.literal('member.role_changed'),
    payload: z.object({ userId: IdSchema, role: WorkspaceRoleSchema }),
  }),
  WorkspaceEventBaseSchema.extend({
    type: z.literal('member.removed'),
    payload: z.object({ userId: IdSchema }),
  }),
  WorkspaceEventBaseSchema.extend({
    type: z.literal('invitation.created'),
    payload: z.object({ invitationId: IdSchema, role: WorkspaceRoleSchema }),
  }),
  WorkspaceEventBaseSchema.extend({
    type: z.literal('invitation.accepted'),
    payload: z.object({ invitationId: IdSchema, userId: IdSchema, role: WorkspaceRoleSchema }),
  }),
]);

export type WorkspaceEvent = z.infer<typeof WorkspaceEventSchema>;
export type WorkspaceEventType = WorkspaceEvent['type'];

export const WORKSPACE_EVENT_TYPES = [
  'workspace.created',
  'workspace.archived',
  'member.joined',
  'member.role_changed',
  'member.removed',
  'invitation.created',
  'invitation.accepted',
] as const satisfies readonly WorkspaceEventType[];

export type CreateWorkspaceEventInput = z.input<typeof WorkspaceEventSchema>;
