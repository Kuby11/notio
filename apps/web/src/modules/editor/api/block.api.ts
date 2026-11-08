import type { BlockRepository } from '../types/ports';
import type { Block } from '@notio/contracts';
import { toBlock, toBlockList } from '../utils/mapper';
import { HttpError, type TokenProvider } from '../../../shared/types';
import { env } from '../../../shared/configs/env';

export function createBlockRepositoryApi(accessToken: TokenProvider): BlockRepository {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await accessToken.execute();

    if (token === null) {
      throw new HttpError(401, 'Authorization required');
    }

    return { authorization: `Bearer ${token}` };
  }

  return {
    async listByPage(pageId: string) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/pages/${pageId}/blocks`, { headers });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to load blocks: HTTP ${response.status}`);
      }

      return toBlockList(await response.json()).items;
    },

    async create(pageId: string, content: Block['content'], afterBlockId?: string) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/blocks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ pageId, content, afterBlockId }),
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to create block: HTTP ${response.status}`);
      }

      return toBlock(await response.json());
    },

    async update(id: string, content: Block['content']) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/blocks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to update block: HTTP ${response.status}`);
      }

      return toBlock(await response.json());
    },

    async delete(id: string) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/blocks/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        throw new HttpError(response.status, `Failed to delete block: HTTP ${response.status}`);
      }
    },

    async move(id: string, afterBlockId?: string) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/blocks/${id}/move`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify({ afterBlockId }),
      });

      if (!response.ok) {
        throw new HttpError(
          response.status,
          `Failed to move block: HTTP ${response.status}`,
        );
      }

      return toBlock(await response.json());
    },
  };
}
