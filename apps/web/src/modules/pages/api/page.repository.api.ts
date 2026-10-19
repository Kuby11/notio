import type { PageRepository } from '../types/ports';
import type { CreatePageInput, MovePageInput, UpdatePageInput } from '@notio/contracts';
import { toPage, toPageList } from '../utils/mapper';
import type { TokenProvider } from '../../../shared/types';
import { env } from '../../../shared/configs/env';

/**
 * Репозиторий страниц поверх gateway.
 *
 * Запросы идут только через gateway с JWT в заголовке Authorization.
 * Токен выдаёт TokenProvider из shared непосредственно перед запросом и
 * не сохраняется ни в localStorage, ни в Zustand.
 */
export function createPageRepositoryApi(accessToken: TokenProvider): PageRepository {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await accessToken.execute();

    if (token === null) {
      throw new Error('Требуется авторизация');
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
        throw new Error(`Не удалось загрузить страницы: HTTP ${response.status}`);
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
        throw new Error(`Не удалось загрузить избранное: HTTP ${response.status}`);
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
        throw new Error(`Не удалось создать страницу: HTTP ${response.status}`);
      }

      return toPage(await response.json());
    },

    async getPage(id, workspaceId) {
      const headers = await authHeaders();
      const response = await fetch(`${baseUrl}/api/pages/${id}?workspaceId=${workspaceId}`, {
        headers,
      });

      if (!response.ok) {
        throw new Error(`Не удалось загрузить страницу: HTTP ${response.status}`);
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
        throw new Error(`Не удалось обновить страницу: HTTP ${response.status}`);
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
        throw new Error(`Не удалось переместить страницу: HTTP ${response.status}`);
      }

      return toPage(await response.json());
    },
  };
}
