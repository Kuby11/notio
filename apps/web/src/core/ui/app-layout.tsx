'use client';

import { cn } from 'cn';
import { useSidebarStore } from '../stores/sidebar.store';
import { AppSidebar } from './app-sidebar';
import { SettingsDialog } from './settings/settings-dialog';
import { SidebarOpenButton } from './sidebar-open-button';

interface AppLayoutProps {
  children: React.ReactNode;
  workspaceId: string;
}

/**
 * Application shell: sidebar on the left, content on the right.
 *
 * It lives in `core`, not `shared`: the shell assembles modules and knows their
 * public APIs, while `shared` is not allowed to import `modules`.
 *
 * The reopen control for the collapsed sidebar is rendered here rather than by
 * each page: every route of the shell gets it, including the ones without a
 * topbar of their own. While the panel is closed the content keeps a left
 * gutter, so the floating button never covers a heading or a breadcrumb.
 */
export function AppLayout({ children, workspaceId }: AppLayoutProps) {
  const collapsed = useSidebarStore((state) => state.collapsed);

  return (
    <div className="flex h-screen">
      <AppSidebar workspaceId={workspaceId} />
      {/* No top padding: the sticky top bar of the page header is bounded by the
          content box of the scroll container and could not stick to the very
          top while scrolling if pt-6 were applied. */}
      <main
        className={cn(
          'flex-1 overflow-y-auto pb-6 transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
          collapsed ? 'pr-6 pl-12' : 'px-6',
        )}
      >
        {children}
      </main>
      {/* Floating over the left gutter: one control for every page. */}
      <SidebarOpenButton className="fixed top-3 left-3 z-40" />
      {/* Settings dialog: opened from the sidebar profile (store, no props). */}
      <SettingsDialog workspaceId={workspaceId} />
    </div>
  );
}
