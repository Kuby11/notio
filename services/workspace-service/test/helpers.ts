import { INTERNAL_HEADERS } from '@notio/contracts';
import { env as workerEnv } from 'cloudflare:workers';
import type { WorkspaceRole } from '@notio/contracts';
import { createWorkspaceServiceApp } from '../src/app';
import type { Bindings } from '../src/env';
import { MemberRepository } from '../src/repositories/member.repository';

const env = workerEnv as Bindings;

/**
 * The application is built once: the database is shared by all tests, so
 * every test works with its own user and workspace ids.
 */
const app = createWorkspaceServiceApp();

export const TEST_ENV = env;

/** Request headers as a user: the gateway sets the id from the verified JWT. */
export function asUser(userId: string): Record<string, string> {
  return { 'content-type': 'application/json', [INTERNAL_HEADERS.ACTOR_ID]: userId };
}

export function newUserId(): string {
  return crypto.randomUUID();
}

interface CallOptions {
  method?: string;
  body?: unknown;
  userId?: string;
  headers?: Record<string, string>;
}

export function call(path: string, options: CallOptions = {}) {
  const headers = { ...(options.userId ? asUser(options.userId) : {}), ...options.headers };

  return Promise.resolve(
    app.request(
      path,
      {
        method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      },
      env,
    ),
  );
}

export interface WorkspaceBody {
  id: string;
  name: string;
  slug: string;
  archivedAt: string | null;
}

export async function createWorkspace(userId: string, name = 'Workspace') {
  const response = await call('/workspaces', { body: { name }, userId });

  if (response.status !== 201) {
    throw new Error(`Failed to create the workspace: ${response.status}`);
  }

  return (await response.json()) as WorkspaceBody;
}

/**
 * Grants a user a role in a workspace directly in the database.
 * This is state setup for permission tests, not an invitation check —
 * that has its own scenario.
 */
export async function giveRole(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): Promise<void> {
  await new MemberRepository(env).upsert(workspaceId, userId, role, new Date().toISOString());
}

export async function jsonOf<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
