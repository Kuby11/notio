import { AppLayout } from '@/core/ui/app-layout';
import { DatabasePageView } from './database-page-view';

export default async function DatabasePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; databaseId: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { workspaceId, databaseId } = await params;
  const query = await searchParams;
  const view = typeof query.view === 'string' ? query.view : undefined;

  return (
    <AppLayout workspaceId={workspaceId}>
      <div className="pt-6">
        <DatabasePageView databaseId={databaseId} initialViewId={view} />
      </div>
    </AppLayout>
  );
}
