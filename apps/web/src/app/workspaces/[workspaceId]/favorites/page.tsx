import { AppLayout } from '@/core/ui/app-layout';
import { FavoritesList } from '@/modules/pages';

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  return (
    <AppLayout workspaceId={workspaceId}>
      <h1 className="text-2xl font-semibold">Избранное</h1>
      <div className="mt-6">
        <FavoritesList workspaceId={workspaceId} />
      </div>
    </AppLayout>
  );
}
