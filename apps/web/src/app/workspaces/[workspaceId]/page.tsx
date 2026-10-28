import { AppLayout } from '@/core/ui/app-layout';
import { LibraryView } from '@/core/ui/library/library-view';
import { StartPageRedirect } from '@/core/ui/start-page-redirect';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <AppLayout workspaceId={workspaceId}>
      <StartPageRedirect workspaceId={workspaceId} />
      <LibraryView workspaceId={workspaceId} />
    </AppLayout>
  );
}
