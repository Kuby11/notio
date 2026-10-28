import { getTranslations } from 'next-intl/server';
import { AppLayout } from '@/core/ui/app-layout';
import { PageTree } from '@/modules/pages';

/**
 * The app's home page: a sidebar with a workspace switcher and the page tree.
 * The default workspace is the first one in the user's list.
 */
export default async function Home() {
  const t = await getTranslations('workspace');

  return (
    <AppLayout workspaceId="00000000-0000-4000-8000-000000000001">
      <h1 className="text-2xl font-semibold">{t('homeTitle')}</h1>
      <p className="mt-2 text-neutral-500">{t('homeHint')}</p>
      <div className="mt-6">
        <PageTree workspaceId="00000000-0000-4000-8000-000000000001" />
      </div>
    </AppLayout>
  );
}
