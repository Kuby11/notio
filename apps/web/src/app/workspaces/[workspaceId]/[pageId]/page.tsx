import { AppLayout } from '@/core/ui/app-layout';
import { Editor } from '@/modules/editor';

export default async function PageView({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}) {
  const { workspaceId, pageId } = await params;

  return (
    <AppLayout workspaceId={workspaceId}>
      <Editor pageId={pageId} />
    </AppLayout>
  );
}
