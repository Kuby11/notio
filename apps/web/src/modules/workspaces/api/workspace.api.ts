import type { WorkspaceGateway } from '../types/ports';
import type {
  Workspace,
  Member,
  Invitation,
  WorkspaceRole,
  WorkspaceListItem,
} from '@notio/contracts';
import { HttpError, type TokenProvider } from '../../../shared/types';
import { env } from '../../../shared/configs/env';

export function createWorkspaceRepositoryApi(accessToken: TokenProvider): WorkspaceGateway {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await accessToken.execute();

    if (token === null) {
      throw new HttpError(401, 'Требуется авторизация');
    }

    return { authorization: `Bearer ${token}` };
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = await authHeaders();
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...headers, ...init?.headers },
    });

    if (!response.ok) {
      throw new HttpError(response.status, `Запрос не удался: HTTP ${response.status}`);
    }

    return (await response.json()) as T;
  }

  return {
    async list() {
      const data = await request<{ items: WorkspaceListItem[] }>('/api/workspaces');

      return data.items;
    },

    async create(name: string) {
      return request<Workspace>('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
    },

    async rename(workspaceId: string, name: string) {
      return request<Workspace>(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
    },

    async archive(workspaceId: string) {
      return request<Workspace>(`/api/workspaces/${workspaceId}`, { method: 'DELETE' });
    },

    async restore(workspaceId: string) {
      return request<Workspace>(`/api/workspaces/${workspaceId}/restore`, { method: 'POST' });
    },

    async listMembers(workspaceId: string) {
      const data = await request<{ items: Member[] }>(`/api/workspaces/${workspaceId}/members`);

      return data.items;
    },

    async changeRole(workspaceId: string, userId: string, role: WorkspaceRole) {
      return request<Member>(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
    },

    async removeMember(workspaceId: string, userId: string) {
      await request<unknown>(`/api/workspaces/${workspaceId}/members/${userId}`, {
        method: 'DELETE',
      });
    },

    async createInvitation(workspaceId: string, role: 'editor' | 'viewer') {
      return request<Invitation>(`/api/workspaces/${workspaceId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
    },

    async revokeInvitation(workspaceId: string, token: string) {
      await request<unknown>(`/api/workspaces/${workspaceId}/invitations/${token}`, {
        method: 'DELETE',
      });
    },

    async acceptInvitation(token: string) {
      return request<Member>('/api/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token }),
      });
    },
  };
}
