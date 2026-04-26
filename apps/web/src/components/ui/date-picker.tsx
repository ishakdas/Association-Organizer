'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DatePickerProps {
  value: Date | undefined;
  onChange: (next: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  clearable?: boolean;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  disabled,
  placeholder = 'Tarih seç',
  clearable = false,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn(
            'w-full justify-between font-normal',
            !value && 'text-muted-foreground',
          )}
        >
          <span className="inline-flex min-w-0 items-center gap-2 truncate">
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <span className="truncate">
              {value
                ? format(value, 'd MMMM yyyy', { locale: tr })
                : placeholder}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto overflow-hidden rounded-xl border border-border/60 bg-popover p-0 shadow-lg shadow-black/5"
        align="start"
        sideOffset={6}
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => {
            onChange(d);
            if (d) setOpen(false);
          }}
          disabled={disabled}
        />
        {clearable && value && (
          <div className="flex justify-end border-t border-border/60 bg-muted/30 px-2 py-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
              className="h-7 gap-1.5 px-2 text-[11.5px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Temizle
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
