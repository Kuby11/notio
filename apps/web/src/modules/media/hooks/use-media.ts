'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useContainer } from '../../../core/container';
import { checkUploadable, formatBytes } from '../utils/media';
import { toast } from '../../../shared/ui/toast';
import type { FileMeta } from '@notio/contracts';

/**
 * The media module's single facade hook.
 *
 * Checks limits on the client (20 MB image, 50 MB video, 20 MB file),
 * uploads through the port and turns any failure, client-side or server-side (413),
 * into a toast with clear text. Returns null instead of throwing: callers
 * need not tell the causes apart.
 */
export function useMedia() {
  const t = useTranslations('media');
  const { media } = useContainer();

  const upload = useCallback(
    async (
      workspaceId: string,
      file: File,
      kind: 'image' | 'video' | 'file' = 'file',
    ): Promise<FileMeta | null> => {
      const check = checkUploadable(file, kind);

      if (!check.ok) {
        const message =
          check.reason === 'type'
            ? t('errors.type', { type: check.mimeType || t('unknownType') })
            : t('errors.size', {
                limit: formatBytes(check.limitBytes ?? 0, {
                  byte: t('size.byte'),
                  kilobyte: t('size.kilobyte'),
                  megabyte: t('size.megabyte'),
                }),
              });

        toast(message, 'error');
        return null;
      }

      try {
        return await media.upload({ workspaceId, file });
      } catch {
        toast(t('errors.uploadFailed'), 'error');
        return null;
      }
    },
    [media, t],
  );

  return { upload };
}
