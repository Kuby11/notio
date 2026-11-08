import {
  AcceptInvitationInputSchema,
  ChangeMemberRoleInputSchema,
  CreateInvitationInputSchema,
  CreateWorkspaceInputSchema,
  IdSchema,
  INTERNAL_HEADERS,
  InvitationListSchema,
  InvitationSchema,
  MemberListSchema,
  MemberSchema,
  UpdateWorkspaceInputSchema,
  WorkspaceListSchema,
  WorkspaceSchema,
  toProblemErrors,
} from '@notio/contracts';
import type { z } from 'zod';
import { Hono } from 'hono';
import type { AppEnv, Bindings } from '../env';
import { ValidationError } from '../errors';
import {
  createWorkspaceService as buildWorkspaceService,
  requireActorId,
  type WorkspaceService,
} from '../services/workspace.service';

/**
 * The scenario is created per request: in Workers bindings arrive in `env`,
 * so the service cannot be built once at application start.
 */
export type WorkspaceServiceFactory = (env: Bindings) => WorkspaceService;

/** Parses input against the schema; Zod errors become a problem details field list. */
function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    throw new ValidationError('Validation failed', {
      errors: toProblemErrors(result.error),
    });
  }

  return result.data;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError('The request body must be valid JSON');
  }
}

function actorIdOf(c: { req: { header: (name: string) => string | undefined } }): string {
  return requireActorId(c.req.header(INTERNAL_HEADERS.ACTOR_ID));
}

/**
 * Workspace routes. HTTP lives here and only here: input validation,
 * parsing the actor's identity and building the response to the contract.
 */
export function createWorkspaceRoutes(
  createService: WorkspaceServiceFactory = buildWorkspaceService,
): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();

  routes.get('/workspaces', async (c) => {
    const items = await createService(c.env).listForUser(actorIdOf(c));

    return c.json(WorkspaceListSchema.parse({ items }), 200);
  });

  routes.post('/workspaces', async (c) => {
    const input = parseOrThrow(CreateWorkspaceInputSchema, await readJsonBody(c.req.raw));
    const workspace = await createService(c.env).create(actorIdOf(c), input);

    return c.json(WorkspaceSchema.parse(workspace), 201);
  });

  routes.get('/workspaces/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const workspace = await createService(c.env).get(id, actorIdOf(c));

    return c.json(WorkspaceSchema.parse(workspace), 200);
  });

  routes.patch('/workspaces/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(UpdateWorkspaceInputSchema, await readJsonBody(c.req.raw));
    const workspace = await createService(c.env).update(id, actorIdOf(c), input);

    return c.json(WorkspaceSchema.parse(workspace), 200);
  });

  routes.delete('/workspaces/:id', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const workspace = await createService(c.env).archive(id, actorIdOf(c));

    return c.json(WorkspaceSchema.parse(workspace), 200);
  });

  routes.post('/workspaces/:id/restore', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const workspace = await createService(c.env).restore(id, actorIdOf(c));

    return c.json(WorkspaceSchema.parse(workspace), 200);
  });

  routes.get('/workspaces/:id/members', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const members = await createService(c.env).listMembers(id, actorIdOf(c));

    return c.json(MemberListSchema.parse({ items: members }), 200);
  });

  routes.patch('/workspaces/:id/members/:userId', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const userId = parseOrThrow(IdSchema, c.req.param('userId'));
    const input = parseOrThrow(ChangeMemberRoleInputSchema, await readJsonBody(c.req.raw));
    const member = await createService(c.env).changeMemberRole(id, userId, actorIdOf(c), input);

    return c.json(MemberSchema.parse(member), 200);
  });

  routes.delete('/workspaces/:id/members/:userId', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const userId = parseOrThrow(IdSchema, c.req.param('userId'));
    await createService(c.env).removeMember(id, userId, actorIdOf(c));

    return c.body(null, 204);
  });

  routes.get('/workspaces/:id/invitations', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const items = await createService(c.env).listInvitations(id, actorIdOf(c));

    return c.json(InvitationListSchema.parse({ items }), 200);
  });

  routes.post('/workspaces/:id/invitations', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const input = parseOrThrow(CreateInvitationInputSchema, await readJsonBody(c.req.raw));
    const invitation = await createService(c.env).createInvitation(id, actorIdOf(c), input);

    return c.json(InvitationSchema.parse(invitation), 201);
  });

  routes.delete('/workspaces/:id/invitations/:token', async (c) => {
    const id = parseOrThrow(IdSchema, c.req.param('id'));
    const token = parseOrThrow(AcceptInvitationInputSchema.shape.token, c.req.param('token'));
    await createService(c.env).revokeInvitation(id, token, actorIdOf(c));

    return c.body(null, 204);
  });

  routes.post('/invitations/accept', async (c) => {
    const input = parseOrThrow(AcceptInvitationInputSchema, await readJsonBody(c.req.raw));
    const member = await createService(c.env).acceptInvitation(input.token, actorIdOf(c));

    return c.json(MemberSchema.parse(member), 200);
  });

  return routes;
}
