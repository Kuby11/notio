import type { BlockRepository } from '../application/ports';
import type { Block } from '@notio/contracts';
import { toBlock, toBlockList } from './block.mapper';
import { AccessToken } from '../../auth/application/access-token';
import { env } from '../../../shared/config/env';

// env и AccessToken используются как runtime-значения.
void env;
void AccessToken;

export function createBlockRepositoryApi(accessToken: AccessToken): BlockRepository {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await accessToken.execute();

    if (token === null) {
      throw new Error('Требуется авторизация');
    }

    return { authorization: `Bearer ${token}` };
  }

  return {
    async listByPage(pageId: string) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/pages/${pageId}/blocks`, { headers });

      if (!response.ok) {
        throw new Error(`Не удалось загрузить блоки: HTTP ${response.status}`);
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
        throw new Error(`Не удалось создать блок: HTTP ${response.status}`);
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
        throw new Error(`Не удалось обновить блок: HTTP ${response.status}`);
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
        throw new Error(`Не удалось удалить блок: HTTP ${response.status}`);
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
        throw new Error(`Не удалось переместить блок: HTTP ${response.status}`);
      }

      return toBlock(await response.json());
    },
  };
}
