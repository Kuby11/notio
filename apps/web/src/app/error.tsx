'use client';

import { useTranslations } from 'next-intl';

/**
 * Error boundary for the whole application below the root layout.
 *
 * It replaces the default Next screen, which is English-only and offers no
 * way back into the app: `reset` retries the failed segment without a reload.
 */
export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  return (
    <div
      role="alert"
      className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <h1 className="text-lg font-semibold">{t('routeTitle')}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{t('routeDescription')}</p>
      <button
        type="button"
        onClick={reset}
        className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
      >
        {t('retry')}
      </button>
    </div>
  );
}
