'use client';

import { useState } from 'react';
import { format, setHours, setMinutes } from 'date-fns';
import { tr } from 'date-fns/locale';
import { CalendarIcon, ChevronDown, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface DateTimePickerProps {
  value: Date | undefined;
  onChange: (next: Date | undefined) => void;
  disabled?: (date: Date) => boolean;
  placeholder?: string;
  defaultHour?: number;
  defaultMinute?: number;
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
  placeholder = 'Tarih ve saat seç',
  defaultHour = 9,
  defaultMinute = 0,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);

  const hours = value ? value.getHours() : defaultHour;
  const minutes = value ? value.getMinutes() : defaultMinute;

  function updateDate(date: Date | undefined) {
    if (!date) {
      onChange(undefined);
      return;
    }
    const next = setMinutes(setHours(date, hours), minutes);
    onChange(next);
  }

  function updateHour(h: number) {
    const clamped = Math.max(0, Math.min(23, Math.floor(h)));
    const base = value ?? setMinutes(setHours(new Date(), defaultHour), defaultMinute);
    onChange(setHours(base, clamped));
  }

  function updateMinute(m: number) {
    const clamped = Math.max(0, Math.min(59, Math.floor(m)));
    const base = value ?? setMinutes(setHours(new Date(), defaultHour), defaultMinute);
    onChange(setMinutes(base, clamped));
  }

  function setNow() {
    onChange(new Date());
  }

  function clear() {
    onChange(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
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
                ? format(value, 'd MMMM yyyy HH:mm', { locale: tr })
                : placeholder}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={updateDate}
          disabled={disabled}
        />

        <div className="border-t border-border px-3 py-3">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            <Clock className="h-3 w-3" />
            Saat
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={23}
              value={hours}
              onChange={(e) => updateHour(Number(e.target.value))}
              className="h-8 w-14 rounded-sm border border-border bg-transparent px-2 text-center font-mono text-[13px] tabular-nums outline-none focus:border-primary"
              aria-label="Saat"
            />
            <span className="text-[14px] font-semibold text-muted-foreground">
              :
            </span>
            <input
              type="number"
              min={0}
              max={59}
              value={minutes.toString().padStart(2, '0')}
              onChange={(e) => updateMinute(Number(e.target.value))}
              className="h-8 w-14 rounded-sm border border-border bg-transparent px-2 text-center font-mono text-[13px] tabular-nums outline-none focus:border-primary"
              aria-label="Dakika"
            />
            <div className="ml-auto flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={setNow}
                className="h-7 px-2 text-[11.5px]"
              >
                Şimdi
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clear}
                disabled={!value}
                className="h-7 px-2 text-[11.5px]"
                aria-label="Temizle"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
