import { AppLayout } from '../shared/components/app-layout';
import { PageTree } from '../features/pages/ui/page-tree';

/**
 * Главная страница приложения: сайдбар с переключателем workspace и деревом
 * страниц. Рабочее пространство по умолчанию — первое из списка пользователя.
 */
export default function Home() {
  return (
    <AppLayout workspaceId="00000000-0000-4000-8000-000000000001">
      <h1 className="text-2xl font-semibold">Рабочее пространство</h1>
      <p className="mt-2 text-neutral-500">Выберите страницу в сайдбаре или создайте новую.</p>
      <div className="mt-6">
        <PageTree workspaceId="00000000-0000-4000-8000-000000000001" />
      </div>
    </AppLayout>
  );
}
