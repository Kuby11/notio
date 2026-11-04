import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';
import { env } from '../shared/configs/env';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations('meta');

  return {
    name: env.NEXT_PUBLIC_APP_NAME,
    short_name: env.NEXT_PUBLIC_APP_NAME,
    description: t('description'),
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
  };
}
