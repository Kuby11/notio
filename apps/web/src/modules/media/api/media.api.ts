import type { FileMeta } from '@notio/contracts';
import { FileMetaSchema } from '@notio/contracts';
import { HttpError, type TokenProvider } from '../../../shared/types';
import { env } from '../../../shared/configs/env';
import type { MediaRepository } from '../types/ports';

/**
 * Репозиторий медиа поверх gateway.
 *
 * Файл уходит multipart-запросом; ошибки RFC 7807 превращаются в HttpError
 * с деталью от сервиса — по ней строится текст тоста про размер или тип.
 */
/** Текст ошибки из RFC 7807 ответа; при мусоре — статус. */
async function problemMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string };

    return body.detail ?? `Не удалось загрузить файл: HTTP ${response.status}`;
  } catch {
    return `Не удалось загрузить файл: HTTP ${response.status}`;
  }
}

export function createMediaRepositoryApi(accessToken: TokenProvider): MediaRepository {
  const baseUrl = env.NEXT_PUBLIC_GATEWAY_URL;

  async function authHeaders(): Promise<Record<string, string>> {
    const token = await accessToken.execute();

    if (token === null) {
      throw new HttpError(401, 'Требуется авторизация');
    }

    return { authorization: `Bearer ${token}` };
  }

  return {
    async upload({ workspaceId, file }) {
      const headers = await authHeaders();
      const form = new FormData();

      form.set('workspaceId', workspaceId);
      form.set('file', file);

      const response = await fetch(`${baseUrl}/api/media/files`, {
        method: 'POST',
        headers,
        body: form,
      });

      if (!response.ok) {
        throw new HttpError(response.status, await problemMessage(response));
      }

      return FileMetaSchema.parse(await response.json()) satisfies FileMeta;
    },
  };
}
