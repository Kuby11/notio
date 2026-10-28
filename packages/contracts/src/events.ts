import { z } from 'zod';
import { PageSchema } from './page';
import { WorkspaceRoleSchema, WorkspaceSchema } from './workspace';
import { IdSchema, IsoDateTimeSchema } from './ids';

/**
 * Domain events for asynchronous processing (Queues).
 * The search index, webhooks and cleanup subscribe to these types, so the
 * payload lives here rather than in each consumer.
 */
export const PageEventBaseSchema = z.object({
  /** Event id: deduplication on the consumer side. */
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
      /** true — the page moved to the trash, false — it was restored. */
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
 * Events for workspaces and their members.
 * Consumers appear together with realtime and search: subscribing to events
 * must not depend on who publishes them.
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
