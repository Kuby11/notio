'use client';

import { cn } from 'cn';
import type { ReactNode } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

/** One option of a settings picker. */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * A titled group of settings, as in Notion: a heading with a hairline under it,
 * then the rows. The heading is optional for the top of a section.
 */
export function SettingsGroup({
  title,
  hint,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('flex flex-col', className)}>
      <div className="border-b border-border pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint === undefined ? null : (
          <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{hint}</div>
        )}
      </div>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

/**
 * A setting row: label and explanation on the left, the control flush right.
 * The label is a clickable block (as in Notion) that toggles the control when
 * the control itself is a switch, so the whole row is the target.
 */
export function SettingsRow({
  label,
  hint,
  children,
  align = 'center',
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  align?: 'center' | 'start';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex justify-between gap-8 py-3',
        align === 'center' ? 'items-center' : 'items-start',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {hint === undefined ? null : (
          <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed">{hint}</div>
        )}
      </div>
      <div className={cn('flex shrink-0 items-center gap-2', align === 'start' && 'mt-0.5')}>
        {children}
      </div>
    </div>
  );
}

/**
 * shadcn picker used by every settings row. The `items` map lets the trigger
 * render the human label instead of the raw stored value, styled as a compact
 * outline button with a chevron (as in the Notion settings).
 */
export function SettingsSelect({
  label,
  value,
  options,
  onValueChange,
  disabled = false,
  placeholder,
  className,
}: {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onValueChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (typeof next === 'string') {
          onValueChange(next);
        }
      }}
    >
      <SelectTrigger
        aria-label={label}
        className={cn(
          'w-44 justify-between gap-2 rounded-md border border-border bg-transparent px-2.5 text-sm hover:bg-accent/40 data-[size=default]:h-8',
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
