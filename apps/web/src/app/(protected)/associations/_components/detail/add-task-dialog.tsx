'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
  CalendarIcon,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Loader2,
  Plus,
  Search,
} from 'lucide-react';
import {
  createTaskSchema,
  type CreateTaskInput,
  type ReminderFrequencyValue,
  type TaskPriorityValue,
} from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { cn } from '@/lib/utils';
import { useMembers } from '../../_hooks/use-members';
import { useCreateTask } from '../../_hooks/use-tasks';

const PRIORITY_OPTIONS: {
  value: TaskPriorityValue;
  label: string;
}[] = [
  { value: 'LOW', label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH', label: 'Yüksek' },
];

const FREQ_OPTIONS: { value: ReminderFrequencyValue; label: string }[] = [
  { value: 'NONE', label: 'Yok' },
  { value: 'ONCE', label: 'Bir kez' },
  { value: 'DAILY', label: 'Günlük' },
  { value: 'WEEKLY', label: 'Haftalık' },
  { value: 'MONTHLY', label: 'Aylık' },
];

const formSchema = z
  .object({
    title: z.string().min(2, 'En az 2 karakter').max(200),
    description: z.string().max(2000).optional(),
    assignedToUserId: z.string().min(1, 'Atanacak kişiyi seçin'),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    dueDate: z.date().optional(),
    reminderFrequency: z.enum(['NONE', 'ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']),
    reminderAt: z.date().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.reminderFrequency !== 'NONE' && !v.reminderAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderAt'],
        message: 'Hatırlatma için tarih girin',
      });
    }
    if (v.reminderAt && v.dueDate && v.reminderAt > v.dueDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderAt'],
        message: 'Hatırlatma tarihi bitiş tarihinden önce olmalı',
      });
    }
  });
type FormValues = z.infer<typeof formSchema>;

export function AddTaskDialog({
  associationId,
  triggerLabel = 'Görev ekle',
}: {
  associationId: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      assignedToUserId: '',
      priority: 'MEDIUM',
      dueDate: undefined,
      reminderFrequency: 'NONE',
      reminderAt: undefined,
    },
  });

  const reminderFrequency = form.watch('reminderFrequency');

  const mutation = useCreateTask(associationId, {
    onSuccess: () => {
      form.reset();
      setOpen(false);
    },
  });

  function onSubmit(values: FormValues) {
    const payload: CreateTaskInput = {
      title: values.title,
      description: values.description || undefined,
      assignedToUserId: values.assignedToUserId,
      priority: values.priority,
      dueDate: values.dueDate ? values.dueDate.toISOString() : undefined,
      reminderFrequency: values.reminderFrequency,
      reminderAt: values.reminderAt ? values.reminderAt.toISOString() : undefined,
    };

    const parsed = createTaskSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        const map: Record<string, keyof FormValues> = {
          title: 'title',
          description: 'description',
          assignedToUserId: 'assignedToUserId',
          priority: 'priority',
          dueDate: 'dueDate',
          reminderAt: 'reminderAt',
          reminderFrequency: 'reminderFrequency',
        };
        if (typeof path === 'string' && map[path]) {
          form.setError(map[path], { message: issue.message });
        }
      }
      return;
    }

    mutation.mutate(parsed.data);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Yeni görev</DialogTitle>
          <DialogDescription>
            Görevi dernek üyelerinden birine atayın. Hatırlatma seçerseniz
            sistem ileride bildirim gönderecek.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Örn. Yıllık raporu hazırla"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Açıklama</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Detay, kabul kriteri, link…"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assignedToUserId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Atanan kişi *</FormLabel>
                  <FormControl>
                    <AssigneeCombobox
                      associationId={associationId}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Öncelik *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Bitiş tarihi</FormLabel>
                    <DatePopover
                      value={field.value}
                      onChange={field.onChange}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <fieldset className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
              <legend className="px-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Hatırlatma
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="reminderFrequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sıklık</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FREQ_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {reminderFrequency !== 'NONE' && (
                  <FormField
                    control={form.control}
                    name="reminderAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>
                          {reminderFrequency === 'ONCE'
                            ? 'Tarih'
                            : 'İlk hatırlatma'}
                        </FormLabel>
                        <DatePopover
                          value={field.value}
                          onChange={field.onChange}
                        />
                        <FormDescription className="text-[11.5px]">
                          {reminderFrequency === 'ONCE'
                            ? 'Bitiş tarihinden önce olmalı.'
                            : 'Bu tarihten itibaren tekrar eder.'}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>
            </fieldset>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Ekleniyor…
                  </>
                ) : (
                  'Görev oluştur'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AssigneeCombobox({
  associationId,
  value,
  onChange,
}: {
  associationId: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: members, isLoading } = useMembers(associationId);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return members;
    return members.filter(
      (m) =>
        m.user.fullName.toLocaleLowerCase('tr-TR').includes(q) ||
        (m.user.email ?? '').toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [members, query]);

  const selected = members?.find((m) => m.user.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between font-normal',
            !selected && 'text-muted-foreground',
          )}
        >
          {selected ? selected.user.fullName : 'Üye seçin…'}
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="border-b border-border px-2.5 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ada veya e-postaya göre ara…"
              className="h-8 w-full rounded-sm border-0 bg-transparent pl-7 text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div role="listbox" className="max-h-[260px] overflow-y-auto py-1">
          {isLoading && (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">
              Yükleniyor…
            </div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">
              Kayıt yok
            </div>
          )}
          {filtered.map((m) => {
            const active = m.user.id === value;
            return (
              <button
                key={m.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(m.user.id);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent/60',
                  active && 'bg-accent',
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-foreground">
                    {m.user.fullName}
                  </span>
                  {m.user.email && (
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {m.user.email}
                    </span>
                  )}
                </span>
                {active && <Check className="h-3.5 w-3.5 text-primary" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DatePopover({
  value,
  onChange,
}: {
  value: Date | undefined;
  onChange: (next: Date | undefined) => void;
}) {
  return (
    <DateTimePicker
      value={value}
      onChange={onChange}
      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
      placeholder="Tarih ve saat seç"
    />
  );
}
