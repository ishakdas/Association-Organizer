'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import {
  AlertCircle,
  CalendarIcon,
  ChevronDown,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  createMeetingNoteSchema,
  type CreateMeetingNoteInput,
} from '@ticketbot/shared-validation';
import type { AnalyzedActionItem } from '@/lib/api/meetings';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useMembers } from '../../_hooks/use-members';
import { useCreateMeeting, useAnalyzeMeeting } from '../../_hooks/use-meetings';

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

type ReviewTask = {
  id: string;
  title: string;
  description: string;
  assignedToUserId: string | null;
};

export function AddMeetingDialog({
  associationId,
  triggerLabel = 'Toplantı notu ekle',
}: {
  associationId: string;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [step, setStep] = useState<'form' | 'review'>('form');
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      meetingDate: new Date(),
      attendeeUserIds: [],
      content: '',
    },
  });

  const content = form.watch('content');

  const createMutation = useCreateMeeting(associationId, {
    onSuccess: () => {
      form.reset({ title: '', meetingDate: new Date(), attendeeUserIds: [], content: '' });
      setReviewTasks([]);
      setStep('form');
      setOpen(false);
    },
  });

  const analyzeMutation = useAnalyzeMeeting(associationId, {
    onSuccess: (result) => {
      setReviewTasks(
        result.actionItems.map((item, i) => ({
          id: String(i),
          title: item.title,
          description: item.description ?? '',
          assignedToUserId: item.assignedToUserId ?? null,
        })),
      );
      setStep('review');
    },
  });

  function onAnalyze() {
    const currentContent = form.getValues('content');
    if (!currentContent.trim()) {
      form.setError('content', { message: 'Analiz için içerik giriniz' });
      return;
    }
    analyzeMutation.mutate(currentContent);
  }

  function buildPayload(withTasks: boolean): CreateMeetingNoteInput | null {
    const values = form.getValues();
    const payload: CreateMeetingNoteInput = {
      title: values.title,
      content: values.content,
      meetingDate: values.meetingDate.toISOString(),
      attendeeUserIds: values.attendeeUserIds,
      preApprovedTasks: withTasks
        ? reviewTasks
            .filter((t) => t.title.trim())
            .map((t) => ({
              title: t.title.trim(),
              description: t.description.trim() || null,
              assignedToUserId: t.assignedToUserId || null,
            }))
        : [],
    };
    const parsed = createMeetingNoteSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  }

  function onSaveWithTasks() {
    const payload = buildPayload(true);
    if (payload) createMutation.mutate(payload);
  }

  function onSaveWithoutTasks() {
    const payload = buildPayload(false);
    if (payload) createMutation.mutate(payload);
  }

  function onSubmit(values: FormValues) {
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

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setStep('form');
      setReviewTasks([]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className={cn('transition-all duration-200', step === 'review' ? 'sm:max-w-[860px]' : 'sm:max-w-[760px]')}>
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Yeni toplantı notu</DialogTitle>
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

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/20 px-3 py-2">
                  <div className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                    Notu yapay zeka ile analiz edip görev önerileri alın, ardından düzenleyip kaydedin.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onAnalyze}
                    disabled={analyzeMutation.isPending}
                  >
                    {analyzeMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Analiz ediliyor…</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" />Notu analiz et</>
                    )}
                  </Button>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={createMutation.isPending}
                  >
                    Vazgeç
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Kaydediliyor…</>
                    ) : (
                      'Notu kaydet'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <AiReviewStep
            tasks={reviewTasks}
            associationId={associationId}
            onChange={setReviewTasks}
            onBack={() => setStep('form')}
            onSave={onSaveWithTasks}
            onSaveWithoutTasks={onSaveWithoutTasks}
            isSaving={createMutation.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function AiReviewStep({
  tasks,
  associationId,
  onChange,
  onBack,
  onSave,
  onSaveWithoutTasks,
  isSaving,
}: {
  tasks: ReviewTask[];
  associationId: string;
  onChange: (tasks: ReviewTask[]) => void;
  onBack: () => void;
  onSave: () => void;
  onSaveWithoutTasks: () => void;
  isSaving: boolean;
}) {
  const { data: members } = useMembers(associationId);

  function updateTask(id: string, patch: Partial<ReviewTask>) {
    onChange(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTask(id: string) {
    onChange(tasks.filter((t) => t.id !== id));
  }

  function addTask() {
    onChange([
      ...tasks,
      { id: String(Date.now()), title: '', description: '', assignedToUserId: null },
    ]);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          Yapay Zeka Görev Önerileri
        </DialogTitle>
        <DialogDescription>
          {tasks.length > 0
            ? `${tasks.length} görev önerisi oluşturuldu. Düzenleyin, silin veya yeni görev ekleyin.`
            : 'Toplantı notunuzdan görev önerisi çıkarılamadı. Manuel görev ekleyebilirsiniz.'}
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
        {tasks.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-[13px] text-muted-foreground">Görev önerisi bulunamadı.</p>
          </div>
        )}

        {tasks.map((task, idx) => (
          <div
            key={task.id}
            className="grid gap-2 rounded-md border border-border bg-muted/20 p-3"
          >
            <div className="flex items-start gap-2">
              <span className="mt-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
                {idx + 1}
              </span>
              <div className="flex-1 space-y-2">
                <Input
                  value={task.title}
                  onChange={(e) => updateTask(task.id, { title: e.target.value })}
                  placeholder="Görev başlığı"
                  className="h-8 text-[13px] font-medium"
                />
                <Textarea
                  value={task.description}
                  onChange={(e) => updateTask(task.id, { description: e.target.value })}
                  placeholder="Açıklama (isteğe bağlı)"
                  rows={2}
                  className="text-[12px] leading-relaxed"
                />
                <div className="flex items-center gap-2">
                  <span className="shrink-0 text-[11px] text-muted-foreground">Atanan kişi:</span>
                  <Select
                    value={task.assignedToUserId ?? '__none__'}
                    onValueChange={(v) =>
                      updateTask(task.id, { assignedToUserId: v === '__none__' ? null : v })
                    }
                  >
                    <SelectTrigger className="h-7 flex-1 text-[12px]">
                      <SelectValue placeholder="Kişi seçin…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">Atanmamış</span>
                      </SelectItem>
                      {members?.map((m) => (
                        <SelectItem key={m.user.id} value={m.user.id}>
                          <span>{m.user.fullName}</span>
                          {(m.customTitle || m.title?.name) && (
                            <span className="ml-1.5 text-muted-foreground">
                              — {m.customTitle ?? m.title?.name}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeTask(task.id)}
                title="Görevi kaldır"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full border-dashed"
          onClick={addTask}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Görev ekle
        </Button>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onBack} disabled={isSaving}>
          ← Geri dön
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onSaveWithoutTasks}
          disabled={isSaving}
        >
          {isSaving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Kaydediliyor…</>
          ) : (
            'Görevsiz kaydet'
          )}
        </Button>
        <Button type="button" onClick={onSave} disabled={isSaving || tasks.filter(t => t.title.trim()).length === 0}>
          {isSaving ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Kaydediliyor…</>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              Notu ve {tasks.filter(t => t.title.trim()).length} görevi kaydet
            </>
          )}
        </Button>
      </DialogFooter>
    </>
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
