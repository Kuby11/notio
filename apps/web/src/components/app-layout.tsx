'use client';

import { AppSidebar } from './app-sidebar';

interface AppLayoutProps {
  children: React.ReactNode;
  workspaceId: string;
}

/**
 * Общий layout приложения: сайдбар слева, контент справа.
 * Сайдбар содержит переключатель workspace, дерево страниц, избранное и корзину.
 */
export function AppLayout({ children, workspaceId }: AppLayoutProps) {
  return (
    <div className="flex h-screen">
      <AppSidebar workspaceId={workspaceId} />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
