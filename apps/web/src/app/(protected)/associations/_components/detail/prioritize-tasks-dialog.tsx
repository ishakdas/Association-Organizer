'use client';

import { useState } from 'react';
import {
  AlertCircle,
  Flag,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { usePrioritizeTasks } from '../../_hooks/use-tasks';
import { useTasks } from '../../_hooks/use-tasks';
import { useMembers } from '../../_hooks/use-members';
import type { PrioritizeTasksResponse } from '@/lib/api/tasks';

const PRIORITY_STYLE: Record<string, string> = {
  YUKSEK: 'bg-destructive/10 text-destructive border-destructive/20',
  ORTA: 'bg-primary/10 text-primary border-primary/20',
  DUSUK: 'bg-muted text-muted-foreground border-border',
};

export function PrioritizeTasksDialog({
  associationId,
}: {
  associationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<PrioritizeTasksResponse | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  const { data: tasksData } = useTasks(associationId, { pageSize: 100 });
  const { data: members } = useMembers(associationId);

  const userById = new Map((members ?? []).map((m) => [m.user.id, m.user.fullName]));

  const mutation = usePrioritizeTasks(associationId, {
    onSuccess: (r) => {
      setResult(r);
      setState('done');
    },
    onError: () => setState('error'),
  });

  function handleOpen() {
    setResult(null);
    setState('loading');
    mutation.mutate();
  }

  const taskMap = new Map(tasksData?.data.map((t) => [t.id, t]) ?? []);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) handleOpen();
        else {
          setState('idle');
          setResult(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-primary/30 bg-primary/5 text-[11px] text-foreground hover:border-primary/50 hover:bg-primary/15 hover:text-foreground"
        >
          <Sparkles className="h-3 w-3 text-primary" />
          Önceliklendir
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[640px]">
        {state === 'loading' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Görevler önceliklendiriliyor…
              </DialogTitle>
              <DialogDescription>
                Yapay zeka görevleri analiz ediyor ve öncelik önerileri oluşturuyor.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              <p className="text-[13px] text-muted-foreground">
                Görevler inceleniyor…
              </p>
            </div>
          </>
        )}

        {state === 'done' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Öncelik Önerileri
              </DialogTitle>
              <DialogDescription>
                {result.prioritizedTasks.length > 0
                  ? `${result.prioritizedTasks.length} görev için öncelik önerildi`
                  : 'Önceliklendirilecek görev bulunamadı'}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {result.prioritizedTasks.length === 0 && (
                <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center">
                  <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-[13px] text-muted-foreground">
                    Bekleyen görev bulunamadı.
                  </p>
                </div>
              )}

              {result.prioritizedTasks.map((pt, idx) => {
                const task = taskMap.get(pt.taskId);
                return (
                  <div
                    key={pt.taskId}
                    className="rounded-md border border-border bg-muted/20 p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          {idx + 1}
                        </span>
                        <h4 className="text-[13px] font-semibold">
                          {task?.title ?? 'Bilinmeyen görev'}
                        </h4>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn('gap-1', PRIORITY_STYLE[pt.priority] ?? '')}
                      >
                        <Flag className="h-3 w-3" />
                        {pt.priority === 'YUKSEK'
                          ? 'Yüksek'
                          : pt.priority === 'ORTA'
                            ? 'Orta'
                            : 'Düşük'}
                      </Badge>
                    </div>
                    {task?.assignedToUserId && (
                      <p className="text-[11px] text-muted-foreground">
                        Atanan: {userById.get(task.assignedToUserId) ?? task.assignedToUserId}
                      </p>
                    )}
                    <p className="text-[12px] text-muted-foreground">
                      {pt.reason}
                    </p>
                  </div>
                );
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Kapat
              </Button>
            </DialogFooter>
          </>
        )}

        {state === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Önceliklendirme başarısız
              </DialogTitle>
              <DialogDescription>
                Yapay zeka servisine ulaşılamadı. Lütfen daha sonra tekrar deneyin.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Kapat
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}