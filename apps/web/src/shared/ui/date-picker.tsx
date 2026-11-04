'use client';

import { CalendarDays } from 'lucide-react';
import { useState } from 'react';
import { cn } from 'cn';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface DatePickerProps {
  /** Local calendar date in ISO form (`YYYY-MM-DD`). */
  value?: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  ariaLabel?: string;
  clearLabel?: string;
  className?: string;
}

/** Parses `YYYY-MM-DD` as a local date, so the calendar day never shifts by a time zone. */
function parseDate(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/u.exec(value);

  if (!match) {
    return undefined;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Formats a local date as `YYYY-MM-DD` without converting it to UTC. */
function toIsoDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** shadcn date picker: a Popover with a Calendar, used instead of the native date input. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Empty',
  ariaLabel,
  clearLabel = 'Clear',
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseDate(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            className={cn(
              'hover:bg-muted/50 flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors',
              !selected && 'text-muted-foreground italic',
              className,
            )}
          />
        }
      >
        <CalendarDays className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
        <span className="truncate">{selected ? formatDate(selected) : placeholder}</span>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={(date) => {
            onChange(date ? toIsoDate(date) : null);
            setOpen(false);
          }}
        />

        {selected ? (
          <div className="border-t p-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {clearLabel}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
