'use client';

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { cn } from 'cn';
import { buttonVariants } from './button';

/** shadcn's Calendar: react-day-picker with the app's button and colour tokens. */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'w-full',
        month_caption: 'flex h-7 w-full items-center justify-center px-8',
        caption_label: 'text-sm font-medium',
        nav: 'absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1',
        button_previous: cn(
          buttonVariants({ variant: 'outline' }),
          'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline' }),
          'size-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse space-y-1',
        weekdays: 'flex',
        weekday: 'text-muted-foreground w-9 rounded-md text-[0.8rem] font-normal',
        week: 'mt-2 flex w-full',
        day: 'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: 'size-9 p-0 font-normal aria-selected:opacity-100',
        range_start: 'rounded-l-md bg-accent',
        range_end: 'rounded-r-md bg-accent',
        selected:
          'rounded-md bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        today: 'rounded-md bg-accent text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        range_middle: 'aria-selected:bg-accent aria-selected:text-accent-foreground',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === 'left' ? (
            <ChevronLeftIcon className="size-4" />
          ) : (
            <ChevronRightIcon className="size-4" />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
