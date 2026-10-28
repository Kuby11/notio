import { AppLayout } from '@/core/ui/app-layout';
import { LastPageTracker } from '@/core/ui/last-page-tracker';
import { Editor } from '@/modules/editor';
import { PageHeader } from '@/modules/pages';

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
