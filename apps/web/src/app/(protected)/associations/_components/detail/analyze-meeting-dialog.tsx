'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  UserX,
} from 'lucide-react';
import type { MeetingNoteResponse } from '@ticketbot/shared-validation';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { useMembers } from '../../_hooks/use-members';
import { useAnalyzeMeeting } from '../../_hooks/use-meetings';
import { useCreateTask } from '../../_hooks/use-tasks';
import { getAccessToken } from '../../_hooks/use-associations';
import { createTask } from '@/lib/api/tasks';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

function oneWeekFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

type ReviewTask = {
  id: string;
  title: string;
  description: string;
  assignedToUserId: string | null;
  dueDate: Date | undefined;
};

type DialogState = 'analyzing' | 'review' | 'saving' | 'done';

export function AnalyzeMeetingDialog({
  meeting,
  associationId,
}: {
  meeting: MeetingNoteResponse;
  associationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<DialogState>('analyzing');
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const analyzeTriggered = useRef(false);
  const queryClient = useQueryClient();

  const { data: members } = useMembers(associationId);

  const analyzeMutation = useAnalyzeMeeting(associationId, {
    onSuccess: (result) => {
      setTasks(
        result.actionItems.map((item, i) => ({
          id: String(i),
          title: item.title,
          description: item.description ?? '',
          assignedToUserId: item.assignedToUserId ?? null,
          dueDate: item.dueDate ? new Date(item.dueDate) : oneWeekFromNow(),
        })),
      );
      setState('review');
    },
  });

  useEffect(() => {
    if (open && !analyzeTriggered.current) {
      analyzeTriggered.current = true;
      setState('analyzing');
      analyzeMutation.mutate(meeting.content);
    }
    if (!open) {
      analyzeTriggered.current = false;
      setState('analyzing');
      setTasks([]);
    }
  }, [open]);

  function updateTask(id: string, patch: Partial<ReviewTask>) {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTask(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  function addTask() {
    setTasks((prev) => [
      ...prev,
      { id: String(Date.now()), title: '', description: '', assignedToUserId: null, dueDate: oneWeekFromNow() },
    ]);
  }

  const assignableTasks = tasks.filter(
    (t) => t.title.trim() && t.assignedToUserId,
  );
  const unassignedTasks = tasks.filter(
    (t) => t.title.trim() && !t.assignedToUserId,
  );

  async function handleSave() {
    if (assignableTasks.length === 0) return;
    setState('saving');
    try {
      const token = await getAccessToken();
      await Promise.all(
        assignableTasks.map((t) =>
          createTask(token, associationId, {
            title: t.title.trim(),
            description: t.description.trim() || undefined,
            assignedToUserId: t.assignedToUserId!,
            priority: 'MEDIUM',
            reminderFrequency: 'NONE',
            dueDate: t.dueDate ? t.dueDate.toISOString() : undefined,
          }),
        ),
      );
      queryClient.invalidateQueries({ queryKey: ['tasks', associationId] });
      toast.success(
        `${assignableTasks.length} görev "${meeting.title}" notundan oluşturuldu`,
      );
      setState('done');
      setTimeout(() => setOpen(false), 800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Görevler oluşturulamadı');
      setState('review');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11px]">
          <Sparkles className="h-3 w-3 text-violet-500" />
          Yapay Zeka Analizi
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[680px]">
        {state === 'analyzing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Toplantı notu analiz ediliyor…
              </DialogTitle>
              <DialogDescription>
                &ldquo;{meeting.title}&rdquo; notundan görev önerileri çıkarılıyor.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
              <p className="text-[13px] text-muted-foreground">
                Yapay zeka notu inceliyor…
              </p>
            </div>
          </>
        )}

        {(state === 'review' || state === 'saving') && (
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
                  <p className="text-[13px] text-muted-foreground">
                    Görev önerisi bulunamadı.
                  </p>
                </div>
              )}

              {tasks.map((task, idx) => {
                const needsAssignee = task.title.trim() && !task.assignedToUserId;
                return (
                  <div
                    key={task.id}
                    className={`grid gap-2 rounded-md border p-3 ${
                      needsAssignee
                        ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/20'
                        : 'border-border bg-muted/20'
                    }`}
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
                          onChange={(e) =>
                            updateTask(task.id, { description: e.target.value })
                          }
                          placeholder="Açıklama (isteğe bağlı)"
                          rows={2}
                          className="text-[12px] leading-relaxed"
                        />
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            <CalendarClock className="inline h-3 w-3 mr-0.5" />
                            Bitiş:
                          </span>
                          <DateTimePicker
                            value={task.dueDate}
                            onChange={(d) => updateTask(task.id, { dueDate: d })}
                            disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                            placeholder="Tarih seç"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            Atanan kişi:
                          </span>
                          <Select
                            value={task.assignedToUserId ?? '__none__'}
                            onValueChange={(v) =>
                              updateTask(task.id, {
                                assignedToUserId: v === '__none__' ? null : v,
                              })
                            }
                          >
                            <SelectTrigger
                              className={`h-7 flex-1 text-[12px] ${needsAssignee ? 'border-amber-400' : ''}`}
                            >
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
                          {needsAssignee && (
                            <UserX className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1 h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTask(task.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}

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

            {tasks.length > 0 && (
              <p
                className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] ${
                  unassignedTasks.length === 0
                    ? 'bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                }`}
              >
                {unassignedTasks.length === 0 ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                    Tüm görevler atandı.
                  </>
                ) : (
                  <>
                    <UserX className="h-3 w-3 shrink-0" />
                    {unassignedTasks.length} görev atanmadı — oluşturulmadan önce kişi
                    seçmelisiniz.
                  </>
                )}
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={state === 'saving'}
              >
                Vazgeç
              </Button>
              <Button
                onClick={handleSave}
                disabled={state === 'saving' || assignableTasks.length === 0}
              >
                {state === 'saving' ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Oluşturuluyor…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    {assignableTasks.length} görevi oluştur
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {state === 'done' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <p className="text-[13px] font-medium text-foreground">
              Görevler başarıyla oluşturuldu
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
