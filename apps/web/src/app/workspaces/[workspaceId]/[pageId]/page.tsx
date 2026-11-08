import type { Metadata } from 'next';
import { AppLayout } from '@/core/ui/app-layout';
import { LastPageTracker } from '@/core/ui/last-page-tracker';
import { Editor } from '@/modules/editor';
import { PageHeader } from '@/modules/pages';
import { fetchPageTitle } from '@/shared/server/metadata';

/**
 * The `<head>` title comes from the opened page through the layout's
 * `%s | notio` template. The lookup is best-effort: without a session or
 * on any failure the layout default applies.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}): Promise<Metadata> {
  const { workspaceId, pageId } = await params;
  const title = await fetchPageTitle(workspaceId, pageId);

  return title === null ? {} : { title };
}

export default async function PageView({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}) {
  const { workspaceId, pageId } = await params;

  return (
    <AppLayout workspaceId={workspaceId}>
      <LastPageTracker workspaceId={workspaceId} pageId={pageId} />
      <PageHeader workspaceId={workspaceId} pageId={pageId} />
      <Editor pageId={pageId} workspaceId={workspaceId} />
    </AppLayout>
  );
}
