'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { tr } from 'date-fns/locale';

import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={tr}
      showOutsideDays={showOutsideDays}
      className={cn('p-3.5 select-none', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'flex flex-col gap-4',
        month_caption:
          'relative flex h-8 items-center justify-center pt-0.5 px-9',
        caption_label:
          'text-[13.5px] font-semibold tracking-tight text-foreground capitalize',
        nav: 'absolute inset-x-0 top-1 flex items-center justify-between px-1',
        button_previous: cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:pointer-events-none disabled:opacity-30',
        ),
        button_next: cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
          'hover:bg-accent hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          'disabled:pointer-events-none disabled:opacity-30',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-9 pb-1.5 text-[10.5px] font-medium uppercase tracking-widest text-muted-foreground/60',
        week: 'flex w-full mt-1',
        day: cn(
          'relative h-9 w-9 p-0 text-center text-[13px]',
          'focus-within:relative focus-within:z-20',
        ),
        day_button: cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-md font-normal text-foreground transition-all duration-150',
          'hover:bg-accent hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        ),
        selected: cn(
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:font-medium [&>button]:shadow-sm',
          'hover:[&>button]:bg-primary hover:[&>button]:text-primary-foreground',
        ),
        today: cn(
          '[&>button]:font-semibold [&>button]:text-primary',
          '[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-primary/30',
          'aria-selected:[&>button]:ring-0 aria-selected:[&>button]:text-primary-foreground',
        ),
        outside: '[&>button]:text-muted-foreground/35',
        disabled:
          '[&>button]:pointer-events-none [&>button]:text-muted-foreground/30 [&>button]:line-through',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-4" {...rest} />
          ) : (
            <ChevronRight className="size-4" {...rest} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
