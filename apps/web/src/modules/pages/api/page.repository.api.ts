import type { PageRepository } from '../types/ports';
import type { CreatePageInput, MovePageInput, UpdatePageInput } from '@notio/contracts';
import { toPage, toPageList } from '../utils/mapper';
import { HttpError, type TokenProvider } from '../../../shared/types';
import { env } from '../../../shared/configs/env';

/**
 * Page repository over the gateway.
 *
 * Requests go only through the gateway with a JWT in the Authorization header.
 * The token is provided by TokenProvider from shared right before the request
 * and is not stored in localStorage or Zustand.
 */
export function createPageRepositoryApi(accessToken: TokenProvider): PageRepository {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await accessToken.execute();

    if (token === null) {
      throw new HttpError(401, 'Authorization required');
    }

    return { authorization: `Bearer ${token}` };
  }

  return {
    async listChildren(workspaceId, parentId, includeTrashed) {
      const headers = await authHeaders();
      const params = new URLSearchParams({ workspaceId, includeTrashed: String(includeTrashed) });

      if (parentId !== null) {
        params.set('parentId', parentId);
      }

      const response = await fetch(`${baseUrl}/api/pages?${params.toString()}`, { headers });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to load pages: HTTP ${response.status}`);
      }

      return toPageList(await response.json()).items;
    },

    async listFavorites(workspaceId) {
      const headers = await authHeaders();
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`${baseUrl}/api/pages/favorites?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to load favorites: HTTP ${response.status}`);
      }

      return toPageList(await response.json()).items;
    },

    async listTrashed(workspaceId) {
      const headers = await authHeaders();
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`${baseUrl}/api/pages/trash?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to load trash: HTTP ${response.status}`);
      }

      return toPageList(await response.json()).items;
    },

    async listAll(workspaceId) {
      const headers = await authHeaders();
      const params = new URLSearchParams({ workspaceId });
      const response = await fetch(`${baseUrl}/api/pages/all?${params.toString()}`, { headers });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to load pages: HTTP ${response.status}`);
      }

      return toPageList(await response.json()).items;
    },

    async search(workspaceId, query) {
      const headers = await authHeaders();
      const params = new URLSearchParams({ workspaceId, q: query });
      const response = await fetch(`${baseUrl}/api/pages/search?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to search pages: HTTP ${response.status}`);
      }

      return toPageList(await response.json()).items;
    },

    async create(input: CreatePageInput) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/pages`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to create page: HTTP ${response.status}`);
      }

      return toPage(await response.json());
    },

    async getPage(id, workspaceId) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/pages/${id}?workspaceId=${workspaceId}`, {
        headers,
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to load page: HTTP ${response.status}`);
      }

      return toPage(await response.json());
    },

    async update(id, workspaceId, patch: UpdatePageInput) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/pages/${id}?workspaceId=${workspaceId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(patch),
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to update page: HTTP ${response.status}`);
      }

      return toPage(await response.json());
    },

    async duplicate(id, workspaceId) {
      const headers = await authHeaders();
      const response = await fetch(
        `${baseUrl}/api/pages/${id}/duplicate?workspaceId=${workspaceId}`,
        {
          method: 'POST',
          headers: { ...headers },
        },
      );

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to duplicate page: HTTP ${response.status}`);
      }

      return toPage(await response.json());
    },

    async move(id, workspaceId, input: MovePageInput) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/pages/${id}/move?workspaceId=${workspaceId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to move page: HTTP ${response.status}`);
      }

      return toPage(await response.json());
    },
  };
}
