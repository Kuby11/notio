'use client';

import type { DatabaseView, DatabaseViewType } from '@notio/contracts';
import {
  BarChart3,
  BarChartHorizontal,
  CalendarDays,
  ChevronDown,
  Clock,
  Copy,
  Hash,
  KanbanSquare,
  LayoutGrid,
  LineChart,
  List,
  Pencil,
  PieChart,
  Plus,
  Table2,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { cn } from 'cn';
import { Button } from '../../../../shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../shared/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../../shared/ui/dropdown-menu';
import { Input } from '../../../../shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../shared/ui/popover';
import { CHART_VIEW_TYPES, VIEW_TYPE_KEYS } from '../../utils/view-types';

export interface ViewTabsProps {
  views: DatabaseView[];
  activeViewId: string | null;
  onSelectView: (viewId: string) => void;
  onAddView: (type: DatabaseViewType, name: string) => void;
  onRenameView: (viewId: string, name: string) => void;
  onDuplicateView: (view: DatabaseView, name: string) => void;
  onDeleteView: (viewId: string) => void;
  onAddRow: () => void;
}

const VIEW_ICONS: Record<DatabaseViewType, LucideIcon> = {
  table: Table2,
  board: KanbanSquare,
  list: List,
  gallery: LayoutGrid,
  calendar: CalendarDays,
  timeline: Clock,
  chart_horizontal: BarChartHorizontal,
  chart_vertical: BarChart3,
  chart_donut: PieChart,
  chart_line: LineChart,
  chart_number: Hash,
};

const ADD_GROUPS: {
  key: 'tables' | 'boards' | 'layouts' | 'charts';
  types: readonly DatabaseViewType[];
}[] = [
  { key: 'tables', types: ['table'] },
  { key: 'boards', types: ['board'] },
  { key: 'layouts', types: ['list', 'gallery', 'calendar'] },
  { key: 'charts', types: CHART_VIEW_TYPES },
];

/**
 * Database view tabs.
 *
 * A tab both selects the view and opens its actions (rename, duplicate,
 * delete), as the tab itself is the view's only handle. New views come from
 * one "+" popover: tables, boards, list/gallery/calendar layouts and all chart
 * variants, instead of separate buttons per type.
 */
export function ViewTabs({
  views,
  activeViewId,
  onSelectView,
  onAddView,
  onRenameView,
  onDuplicateView,
  onDeleteView,
  onAddRow,
}: ViewTabsProps) {
  const t = useTranslations('databases.views');
  const [addOpen, setAddOpen] = useState(false);
  const [renaming, setRenaming] = useState<DatabaseView | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleting, setDeleting] = useState<DatabaseView | null>(null);

  function nextViewName(type: DatabaseViewType): string {
    const base = t(`types.${VIEW_TYPE_KEYS[type]}`);
    const names = new Set(views.map((view) => view.name));
    let name = base;
    let suffix = 2;

    while (names.has(name)) {
      name = `${base} ${suffix}`;
      suffix += 1;
    }

    return name;
  }

  function addView(type: DatabaseViewType): void {
    onAddView(type, nextViewName(type));
    setAddOpen(false);
  }

  function beginRename(view: DatabaseView): void {
    setRenaming(view);
    setRenameValue(view.name);
  }

  function submitRename(): void {
    if (!renaming) {
      return;
    }

    const name = renameValue.trim();

    if (name.length > 0 && name !== renaming.name) {
      onRenameView(renaming.id, name);
    }

    setRenaming(null);
  }

  return (
    <div className="border-border bg-background/50 flex items-center justify-between border-b px-3 py-1">
      <div
        role="tablist"
        aria-label={t('tablistLabel')}
        className="flex min-w-0 items-center gap-1 overflow-x-auto"
      >
        {views.map((view) => {
          const isActive = view.id === activeViewId;
          const Icon = VIEW_ICONS[view.type];

          return (
            <DropdownMenu key={view.id}>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => onSelectView(view.id)}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-md border border-transparent px-2.5 py-1.5 text-xs font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground border-border/50 shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                    )}
                  />
                }
              >
                <Icon className="size-3.5" aria-hidden="true" />
                <span className="max-w-40 truncate">{view.name}</span>
                <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48!">
                <DropdownMenuItem className="text-xs" onClick={() => beginRename(view)}>
                  <Pencil aria-hidden="true" />
                  {t('rename')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs"
                  onClick={() => onDuplicateView(view, t('duplicateName', { name: view.name }))}
                >
                  <Copy aria-hidden="true" />
                  {t('duplicate')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-xs"
                  variant="destructive"
                  disabled={views.length <= 1}
                  onClick={() => setDeleting(view)}
                >
                  <Trash2 aria-hidden="true" />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })}

        <div className="border-border/40 ml-1 flex items-center border-l pl-2">
          <Popover open={addOpen} onOpenChange={setAddOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t('add')}
                  title={t('add')}
                  className="text-muted-foreground hover:text-foreground"
                />
              }
            >
              <Plus aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56! gap-0 p-1">
              {ADD_GROUPS.map((group, index) => (
                <div key={group.key} className={index > 0 ? 'border-t pt-1' : undefined}>
                  <p className="text-muted-foreground px-2 py-1.5 text-[11px] font-medium tracking-wide uppercase">
                    {t(`groups.${group.key}`)}
                  </p>
                  {group.types.map((type) => {
                    const Icon = VIEW_ICONS[type];

                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => addView(type)}
                        className="hover:bg-accent flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm"
                      >
                        <Icon
                          className="text-muted-foreground size-4 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{t(`types.${VIEW_TYPE_KEYS[type]}`)}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="xs" onClick={onAddRow} className="shrink-0 text-xs">
          <Plus aria-hidden="true" />
          {t('newRow')}
        </Button>
      </div>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        {renaming ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('renameTitle')}</DialogTitle>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submitRename();
                }
              }}
              aria-label={t('nameLabel')}
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenaming(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={submitRename}>{t('renameSubmit')}</Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        {deleting ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteTitle')}</DialogTitle>
              <DialogDescription>
                {t('deleteDescription', { name: deleting.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onDeleteView(deleting.id);
                  setDeleting(null);
                }}
              >
                <Trash2 aria-hidden="true" />
                {t('deleteConfirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
