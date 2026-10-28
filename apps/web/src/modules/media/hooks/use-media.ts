'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { useContainer } from '../../../core/container';
import { checkUploadable, formatBytes } from '../utils/media';
import { toast } from '../../../shared/ui/toast';
import type { FileMeta } from '@notio/contracts';

/**
 * Единственный facade-хук модуля медиа.
 *
 * Проверяет лимиты на клиенте (20 МБ изображение, 50 МБ видео, 20 МБ файл),
 * грузит через порт и превращает любые сбои — клиентские и серверные (413) —
 * в тост с понятным текстом. Возвращает null вместо исключения: вызывающему
 * коду не нужно различать причины.
 */
export function useMedia() {
  const t = useTranslations('media');
  const { media } = useContainer();

  const upload = useCallback(
    async (workspaceId: string, file: File): Promise<FileMeta | null> => {
      const check = checkUploadable(file);

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
