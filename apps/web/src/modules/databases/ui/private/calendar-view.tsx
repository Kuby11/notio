'use client';

import type { DatabaseProperty, DatabaseRow, DatabaseView, PropertyValue } from '@notio/contracts';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { cn } from 'cn';
import { Button } from '../../../../shared/ui/button';

export interface CalendarViewProps {
  properties: DatabaseProperty[];
  rows: DatabaseRow[];
  view: DatabaseView;
  /** Opens the row popover, where its data can be edited. */
  onOpenRow?: (row: DatabaseRow) => void;
}

function dateKeyOf(value: PropertyValue | null | undefined): string | null {
  if (typeof value === 'string' && value.length >= 10) {
    return value.slice(0, 10);
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    'start' in value &&
    typeof (value as { start?: unknown }).start === 'string'
  ) {
    return (value as { start: string }).start.slice(0, 10);
  }

  return null;
}

function keyOf(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function firstOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Calendar view: a month grid with rows positioned by the selected date field. */
export function CalendarView({ properties, rows, view, onOpenRow }: CalendarViewProps) {
  const t = useTranslations('databases.calendar');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [month, setMonth] = useState(() => firstOfMonth(new Date()));

  const dateProperty = useMemo(() => {
    const configured = view.groupBy
      ? properties.find(
          (property) => property.id === view.groupBy?.propertyId && property.type === 'date',
        )
      : undefined;

    return configured ?? properties.find((property) => property.type === 'date') ?? null;
  }, [properties, view.groupBy]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, DatabaseRow[]>();

    if (!dateProperty) {
      return map;
    }

    for (const row of rows) {
      const key = dateKeyOf(row.properties[dateProperty.id] ?? null);

      if (!key) {
        continue;
      }

      const current = map.get(key);

      if (current) {
        current.push(row);
      } else {
        map.set(key, [row]);
      }
    }

    return map;
  }, [dateProperty, rows]);

  const days = useMemo(() => {
    const first = firstOfMonth(month);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(gridStart);
      day.setDate(gridStart.getDate() + index);
      return day;
    });
  }, [month]);

  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(2024, 0, 7 + index)),
      ),
    [locale],
  );

  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(month);
  const todayKey = keyOf(new Date());

  if (!dateProperty) {
    return (
      <div className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
        <CalendarDays className="size-6" aria-hidden="true" />
        {t('noDate')}
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t('previous')}
            title={t('previous')}
            onClick={() =>
              setMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))
            }
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <h3 className="min-w-40 text-center text-sm font-semibold capitalize">{monthLabel}</h3>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={t('next')}
            title={t('next')}
            onClick={() =>
              setMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))
            }
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={() => setMonth(firstOfMonth(new Date()))}
          className="text-xs"
        >
          {t('today')}
        </Button>
      </div>

      <div className="border-border overflow-hidden rounded-xl border">
        <div className="bg-muted/30 text-muted-foreground grid grid-cols-7 border-b text-[11px] font-medium">
          {weekdays.map((weekday) => (
            <div key={weekday} className="px-2 py-2 text-center uppercase">
              {weekday}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = keyOf(day);
            const events = eventsByDate.get(key) ?? [];
            const inMonth = day.getMonth() === month.getMonth();
            const isToday = key === todayKey;

            return (
              <div
                key={key}
                className={cn(
                  'border-border/60 min-h-24 border-r border-b p-1.5 last:border-r-0',
                  !inMonth && 'bg-muted/15 text-muted-foreground',
                )}
              >
                <div
                  className={cn(
                    'mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium',
                    isToday && 'bg-primary text-primary-foreground',
                  )}
                >
                  {day.getDate()}
                </div>

                <div className="space-y-1">
                  {events.slice(0, 3).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => onOpenRow?.(row)}
                      className="bg-primary/10 text-foreground block w-full truncate rounded px-1.5 py-1 text-left text-[11px] hover:bg-primary/20"
                      title={row.title || tCommon('untitled')}
                    >
                      {row.title || tCommon('untitled')}
                    </button>
                  ))}
                  {events.length > 3 ? (
                    <p className="text-muted-foreground px-1 text-[10px]">+{events.length - 3}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
