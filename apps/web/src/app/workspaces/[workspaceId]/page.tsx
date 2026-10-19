import { AppLayout } from '@/core/ui/app-layout';
import { PageTree } from '@/modules/pages';

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <AppLayout workspaceId={workspaceId}>
      <h1 className="text-2xl font-semibold">Рабочее пространство</h1>
      <p className="mt-2 text-neutral-500">Выберите страницу в сайдбаре или создайте новую.</p>
      <div className="mt-6">
        <PageTree workspaceId={workspaceId} />
      </div>
    </AppLayout>
  );
}
