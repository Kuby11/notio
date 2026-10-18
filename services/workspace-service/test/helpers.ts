import { INTERNAL_HEADERS } from '@notio/contracts';
import { env as workerEnv } from 'cloudflare:workers';
import type { WorkspaceRole } from '@notio/contracts';
import { createWorkspaceServiceApp } from '../src/app';
import type { Bindings } from '../src/env';
import { MemberRepository } from '../src/repositories/member.repository';

const env = workerEnv as Bindings;

/**
 * Приложение собирается один раз: база общая для всех тестов, поэтому
 * каждый тест работает со своими id пользователей и пространств.
 */
const app = createWorkspaceServiceApp();

export const TEST_ENV = env;

/** Заголовки запроса от имени пользователя: gateway ставит id из проверенного JWT. */
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

/** Создаёт workspace от имени пользователя и возвращает тело ответа. */
export async function createWorkspace(userId: string, name = 'Рабочее пространство') {
  const response = await call('/workspaces', { body: { name }, userId });

  if (response.status !== 201) {
    throw new Error(`Не удалось создать workspace: ${response.status}`);
  }

  return (await response.json()) as WorkspaceBody;
}

/**
 * Выдаёт пользователю роль в workspace напрямую в базе.
 * Это подготовка состояния для тестов прав, а не проверка приглашений —
 * для них есть отдельный сценарий.
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
