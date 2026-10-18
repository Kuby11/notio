import { Editor } from '@/features/editor';

export default async function PageView({
  params,
}: {
  params: Promise<{ workspaceId: string; pageId: string }>;
}) {
  const { pageId } = await params;

  return (
    <div className="flex h-screen">
      <main className="flex-1 overflow-y-auto p-6">
        <Editor pageId={pageId} />
      </main>
    </div>
  );
}
