'use client';

import { AppSidebar } from './app-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  workspaceId: string;
}

/**
 * Каркас приложения: сайдбар слева, контент справа.
 *
 * Живёт в `core`, а не в `shared`: каркас собирает модули и знает про их
 * публичные API, а `shared` не имеет права импортировать `modules`.
 */
export function AppLayout({ children, workspaceId }: AppLayoutProps) {
  return (
    <div className="flex h-screen">
      <AppSidebar workspaceId={workspaceId} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
