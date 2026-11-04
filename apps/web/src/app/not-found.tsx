import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('errors');

  return (
    <div className="flex min-h-96 flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-lg font-semibold">{t('notFoundTitle')}</h1>
      <p className="text-muted-foreground max-w-md text-sm">{t('notFoundDescription')}</p>
      <Link
        href="/"
        className="border-border hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
      >
        {t('backHome')}
      </Link>
    </div>
  );
}
