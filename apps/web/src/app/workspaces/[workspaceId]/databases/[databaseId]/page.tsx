import type { Metadata } from 'next';
import { AppLayout } from '@/core/ui/app-layout';
import { fetchDatabaseTitle } from '@/shared/server/metadata';
import { DatabasePageView } from './database-page-view';

/** The `<head>` title is the opened database's name, not the route or a heading. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; databaseId: string }>;
}): Promise<Metadata> {
  const { databaseId } = await params;
  const title = await fetchDatabaseTitle(databaseId);

  return title === null ? {} : { title };
}

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
