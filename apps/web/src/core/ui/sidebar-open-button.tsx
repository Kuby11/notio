'use client';

import { PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from 'cn';
import { Button } from '@/shared/ui/button';
import { SIDEBAR_ID, useSidebarStore } from '../stores/sidebar.store';

interface SidebarOpenButtonProps {
  className?: string;
}

/**
 * Reopen control for the collapsed sidebar.
 *
 * The sidebar hides completely (width animates to zero), so the way back is a
 * floating button the shell renders above the content's left gutter. Living in
 * `AppLayout` rather than in a page header means every route of the shell has
 * it — including the ones without a topbar. The button renders only while the
 * panel is collapsed and fades in, so the expanded layout stays unchanged.
 */
export function SidebarOpenButton({ className }: SidebarOpenButtonProps) {
  const t = useTranslations('sidebar');
  const collapsed = useSidebarStore((state) => state.collapsed);
  const open = useSidebarStore((state) => state.open);

  if (!collapsed) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={open}
      aria-label={t('openSidebar')}
      aria-controls={SIDEBAR_ID}
      aria-expanded={false}
      title={t('openSidebar')}
      className={cn(
        'text-muted-foreground animate-in fade-in-0 zoom-in-95 shrink-0 duration-200',
        className,
      )}
    >
      <PanelLeftOpen aria-hidden="true" />
    </Button>
  );
}
