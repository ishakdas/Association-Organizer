'use client';

import { useRef, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import {
  CalendarIcon,
  ChevronDown,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import {
  createMeetingNoteSchema,
  type CreateMeetingNoteInput,
  type MeetingNoteResponse,
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { useMembers } from '../../_hooks/use-members';
import { useCreateMeeting, useUpdateMeeting } from '../../_hooks/use-meetings';

const formSchema = z.object({
  title: z.string().min(2, 'En az 2 karakter').max(255),
  meetingDate: z.date({ required_error: 'Tarih zorunlu' }),
  attendeeUserIds: z
    .array(z.string())
    .min(1, 'En az bir katılımcı seçin')
    .max(500),
  content: z.string().min(1, 'İçerik zorunlu').max(50000),
});
type FormValues = z.infer<typeof formSchema>;

export function AddMeetingDialog({
  associationId,
  triggerLabel = 'Toplantı notu ekle',
  initialData,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  associationId: string;
  triggerLabel?: string;
  initialData?: MeetingNoteResponse;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!initialData;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const [showPreview, setShowPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: initialData?.title ?? '',
      meetingDate: initialData ? new Date(initialData.meetingDate) : new Date(),
      attendeeUserIds: initialData?.attendees.map((a) => a.userId) ?? [],
      content: initialData?.content ?? '',
    },
  });

  const content = form.watch('content');

  function handleOpenChange(next: boolean) {
    if (controlledOnOpenChange) {
      controlledOnOpenChange(next);
    } else {
      setInternalOpen(next);
    }
    if (!next && !isEdit) {
      form.reset({ title: '', meetingDate: new Date(), attendeeUserIds: [], content: '' });
    }
  }

  const createMutation = useCreateMeeting(associationId, {
    onSuccess: () => {
      form.reset({ title: '', meetingDate: new Date(), attendeeUserIds: [], content: '' });
      handleOpenChange(false);
    },
  });

  const updateMutation = useUpdateMeeting(associationId, {
    onSuccess: () => handleOpenChange(false),
  });

  const isPending = isEdit ? updateMutation.isPending : createMutation.isPending;

  function onSubmit(values: FormValues) {
    if (isEdit) {
      updateMutation.mutate({
        meetingId: initialData.id,
        input: {
          title: values.title,
          content: values.content,
          meetingDate: values.meetingDate.toISOString(),
          attendeeUserIds: values.attendeeUserIds,
        },
      });
      return;
    }

    const payload: CreateMeetingNoteInput = {
      title: values.title,
      content: values.content,
      meetingDate: values.meetingDate.toISOString(),
      attendeeUserIds: values.attendeeUserIds,
    };
    const parsed = createMeetingNoteSchema.safeParse(payload);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        const map: Record<string, keyof FormValues> = {
          title: 'title',
          meetingDate: 'meetingDate',
          attendeeUserIds: 'attendeeUserIds',
          content: 'content',
        };
        if (typeof path === 'string' && map[path]) {
          form.setError(map[path], { message: issue.message });
        }
      }
      return;
    }
    createMutation.mutate(parsed.data);
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text === 'string') {
        form.setValue('content', text, { shouldValidate: true, shouldDirty: true });
      }
    };
    reader.readAsText(file, 'UTF-8');
    // Reset so the same file can be re-imported
    e.target.value = '';
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Toplantı notunu düzenle' : 'Yeni toplantı notu'}</DialogTitle>
          <DialogDescription>
            Toplantı tarihini, katılımcıları ve markdown formatında notu girin.
            Önizleme yan tarafta canlı güncellenir.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="max-h-[75vh] space-y-4 overflow-y-auto pr-1"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Başlık *</FormLabel>
                  <FormControl>
                    <Input placeholder="Örn. Mart Yönetim Kurulu" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
              <FormField
                control={form.control}
                name="meetingDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Tarih *</FormLabel>
                    <DatePopover value={field.value} onChange={(d) => d && field.onChange(d)} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="attendeeUserIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Katılımcılar *</FormLabel>
                    <FormControl>
                      <AttendeeMultiSelect
                        associationId={associationId}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>İçerik (Markdown) *</FormLabel>
                    <div className="flex items-center gap-1">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".md,.markdown,text/markdown,text/plain"
                        className="hidden"
                        onChange={handleFileImport}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        title="Markdown dosyasından yükle"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Dosyadan yükle
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowPreview((p) => !p)}
                      >
                        {showPreview ? (
                          <><EyeOff className="h-3.5 w-3.5" />Önizlemeyi gizle</>
                        ) : (
                          <><Eye className="h-3.5 w-3.5" />Önizlemeyi göster</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className={cn('grid gap-3', showPreview ? 'md:grid-cols-2' : 'grid-cols-1')}>
                    <FormControl>
                      <Textarea
                        rows={14}
                        placeholder={'# Gündem\n\n- Karar 1\n- Karar 2\n\n## Notlar\n…'}
                        className="font-mono text-[12.5px] leading-relaxed"
                        {...field}
                      />
                    </FormControl>
                    {showPreview && (
                      <div className="prose-meeting min-h-[200px] overflow-y-auto rounded-md border border-border bg-muted/30 p-4 text-[13px] leading-relaxed text-foreground">
                        {content.trim() ? (
                          <ReactMarkdown>{content}</ReactMarkdown>
                        ) : (
                          <p className="text-[12px] text-muted-foreground">
                            Önizleme burada gösterilir…
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Vazgeç
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Kaydediliyor…</>
                ) : isEdit ? (
                  'Değişiklikleri kaydet'
                ) : (
                  'Notu kaydet'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function AttendeeMultiSelect({
  associationId,
  value,
  onChange,
}: {
  associationId: string;
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { data: members, isLoading } = useMembers(associationId);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return members;
    return members.filter((m) =>
      m.user.fullName.toLocaleLowerCase('tr-TR').includes(q),
    );
  }, [members, query]);

  const selectedSet = new Set(value);

  function toggle(userId: string) {
    if (selectedSet.has(userId)) {
      onChange(value.filter((id) => id !== userId));
    } else {
      onChange([...value, userId]);
    }
  }

  const selected = members?.filter((m) => selectedSet.has(m.user.id)) ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="min-h-9 w-full flex-wrap justify-between gap-1.5 px-2 py-1.5 font-normal"
        >
          <span className="flex flex-wrap items-center gap-1">
            {selected.length === 0 ? (
              <span className="px-1 text-muted-foreground">Katılımcı seçin…</span>
            ) : (
              selected.slice(0, 4).map((m) => (
                <Badge key={m.id} variant="secondary" className="gap-1 text-[11px]">
                  {m.user.fullName}
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(m.user.id); }}
                    className="opacity-60 hover:opacity-100"
                    aria-label="Çıkar"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            )}
            {selected.length > 4 && (
              <Badge variant="outline" className="text-[11px]">+{selected.length - 4} kişi</Badge>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="border-b border-border px-2.5 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ara…"
              className="h-8 w-full rounded-sm border-0 bg-transparent pl-7 text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="max-h-[260px] overflow-y-auto py-1">
          {isLoading && (
            <div className="px-3 py-2 text-[12px] text-muted-foreground">Yükleniyor…</div>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="px-3 py-3 text-center text-[12px] text-muted-foreground">Kayıt yok</div>
          )}
          {filtered.map((m) => {
            const checked = selectedSet.has(m.user.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.user.id)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-accent/60',
                  checked && 'bg-accent',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                    checked
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background',
                  )}
                  aria-hidden
                >
                  {checked && (
                    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a1 1 0 010 1.42l-7.5 7.5a1 1 0 01-1.42 0l-3.5-3.5a1 1 0 011.42-1.42L8.5 12.08l6.79-6.79a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{m.user.fullName}</span>
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
  value: Date;
  onChange: (next: Date | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-between font-normal">
          <span className="inline-flex items-center gap-2">
            <CalendarIcon className="h-3.5 w-3.5 opacity-60" />
            {format(value, 'd MMMM yyyy', { locale: tr })}
          </span>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(d) => { onChange(d); if (d) setOpen(false); }}
        />
      </PopoverContent>
    </Popover>
  );
}
