import { AppLayout } from '@/shared/components/app-layout';

export default async function TrashPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;

  return (
    <AppLayout workspaceId={workspaceId}>
      <h1 className="text-2xl font-semibold">Корзина</h1>
      <p className="mt-2 text-neutral-500">Удалённые страницы появятся здесь.</p>
    </AppLayout>
  );
}
