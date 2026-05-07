'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  Loader2,
  Search,
  Send,
} from 'lucide-react';
import {
  reminderFrequencyEnum,
  type ReminderFrequencyValue,
  type TaskPriorityValue,
  type TaskResponse,
  type UpdateTaskInput,
} from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useUpdateTask } from '../../_hooks/use-tasks';

const PRIORITY_OPTIONS: { value: TaskPriorityValue; label: string }[] = [
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
    watcherUserId: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    dueDate: z.date().optional(),
    reminderFrequency: reminderFrequencyEnum,
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

export function EditTaskDialog({
  associationId,
  task,
  open,
  onOpenChange,
}: {
  associationId: string;
  task: TaskResponse;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: members } = useMembers(associationId);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task.title,
      description: task.description ?? '',
      assignedToUserId: task.assignedToUserId,
      watcherUserId: task.watcherUserId ?? '',
      priority: task.priority,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
      reminderFrequency: task.reminderFrequency,
      reminderAt: task.reminderAt ? new Date(task.reminderAt) : undefined,
    },
  });

  // Görev nesnesi yer değiştirebilir (yeniden açma); defaultValues yalnızca
  // mount'ta okunduğu için açıldığında reset'lemek gerekir.
  useEffect(() => {
    if (open) {
      form.reset({
        title: task.title,
        description: task.description ?? '',
        assignedToUserId: task.assignedToUserId,
        watcherUserId: task.watcherUserId ?? '',
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
        reminderFrequency: task.reminderFrequency,
        reminderAt: task.reminderAt ? new Date(task.reminderAt) : undefined,
      });
    }
  }, [open, task.id]);

  const reminderFrequency = form.watch('reminderFrequency');
  const assignedToUserId = form.watch('assignedToUserId');
  const selectedAssignee = members?.find((m) => m.user.id === assignedToUserId);
  const assigneeWillNotBeNotified =
    !!assignedToUserId &&
    selectedAssignee !== undefined &&
    !selectedAssignee.user.telegramAccount &&
    assignedToUserId !== task.assignedToUserId;

  const mutation = useUpdateTask(associationId, {
    onSuccess: () => onOpenChange(false),
  });

  function onSubmit(values: FormValues) {
    const payload: UpdateTaskInput = {
      title: values.title,
      description: values.description?.trim() ? values.description : null,
      assignedToUserId: values.assignedToUserId,
      watcherUserId: values.watcherUserId?.trim() ? values.watcherUserId : null,
      priority: values.priority,
      dueDate: values.dueDate ? values.dueDate.toISOString() : null,
      reminderFrequency: values.reminderFrequency,
      reminderAt:
        values.reminderFrequency === 'NONE'
          ? null
          : values.reminderAt
            ? values.reminderAt.toISOString()
            : null,
    };
    mutation.mutate({ taskId: task.id, input: payload });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Görevi düzenle</DialogTitle>
          <DialogDescription>
            Atanan kişiyi, son tarihi ve hatırlatmayı buradan değiştirebilirsiniz.
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
                    <Input autoFocus {...field} />
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
                    <Textarea rows={3} {...field} />
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
                    <AssigneePicker
                      associationId={associationId}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  {assigneeWillNotBeNotified && (
                    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Bu üyenin Telegram hesabı bağlı değil. Görev yine
                        kaydedilecek; ancak Telegram bildirimi gitmeyecek.
                      </span>
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="watcherUserId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Takipçi</FormLabel>
                  <FormControl>
                    <AssigneePicker
                      associationId={associationId}
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Takipçi seçin (opsiyonel)…"
                      allowClear
                    />
                  </FormControl>
                  <FormDescription className="text-[11.5px]">
                    Görev itiraz edildiğinde bildirim alacak kişi. Boş
                    bırakırsanız görevi oluşturan kişi takipçi olur.
                  </FormDescription>
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
                    <DateTimePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Tarih ve saat seç"
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
                        <DateTimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Tarih ve saat seç"
                        />
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
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Kaydediliyor…
                  </>
                ) : (
                  'Kaydet'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// Combobox with Telegram-status indicator.
function AssigneePicker({
  associationId,
  value,
  onChange,
  placeholder = 'Üye seçin…',
  allowClear = false,
}: {
  associationId: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  allowClear?: boolean;
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
          {selected ? selected.user.fullName : placeholder}
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
          {allowClear && value && !query && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-[12px] text-muted-foreground transition-colors hover:bg-accent/60"
            >
              Seçimi kaldır
            </button>
          )}
          {filtered.map((m) => {
            const active = m.user.id === value;
            const hasTelegram = !!m.user.telegramAccount;
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
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">
                    {m.user.fullName}
                  </span>
                  {m.user.email && (
                    <span className="block truncate text-[11.5px] text-muted-foreground">
                      {m.user.email}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {hasTelegram ? (
                    <span
                      title="Telegram bağlı — bildirim alır"
                      className="inline-flex items-center gap-1 text-[10.5px] text-emerald-700 dark:text-emerald-400"
                    >
                      <Send className="h-3 w-3" />
                    </span>
                  ) : (
                    <span
                      title="Telegram bağlı değil — bildirim almaz"
                      className="inline-flex items-center gap-1 text-[10.5px] text-amber-700 dark:text-amber-400"
                    >
                      <AlertTriangle className="h-3 w-3" />
                    </span>
                  )}
                  {active && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
