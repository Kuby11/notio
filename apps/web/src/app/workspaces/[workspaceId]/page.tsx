import type { Metadata } from 'next';
import { AppLayout } from '@/core/ui/app-layout';
import { LibraryView } from '@/core/ui/library/library-view';
import { StartPageRedirect } from '@/core/ui/start-page-redirect';
import { fetchWorkspaceName } from '@/shared/server/metadata';

/** The library tab shows the workspace the user is in (`%s | notio`). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const name = await fetchWorkspaceName(workspaceId);

  return name === null ? {} : { title: name };
}

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
