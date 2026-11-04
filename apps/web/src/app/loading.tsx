import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';

/**
 * Route-level fallback while a segment streams in. Without it Next renders
 * nothing during navigation, so a slow gateway looked like a dead click.
 */
export default async function Loading(): Promise<ReactNode> {
  const t = await getTranslations('common');

  return (
    <div
      role="status"
      aria-live="polite"
      className="text-muted-foreground flex min-h-64 items-center justify-center p-8 text-sm"
    >
      {t('loading')}
    </div>
  );
}
