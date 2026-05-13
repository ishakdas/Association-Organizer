'use client';

import { useEffect, useRef, useState } from 'react';
import {
  FileText,
  Loader2,
  ScrollText,
  Sparkles,
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
import { useSummarizeMeeting } from '../../_hooks/use-meetings';

const TONE_LABEL: Record<string, { label: string; color: string }> = {
  olumlu: { label: 'Olumlu', color: 'text-emerald-600' },
  nötr: { label: 'Nötr', color: 'text-muted-foreground' },
  gergin: { label: 'Gergin', color: 'text-amber-600' },
  acil: { label: 'Acil', color: 'text-destructive' },
};

export function SummarizeMeetingDialog({
  meeting,
  associationId,
}: {
  meeting: MeetingNoteResponse;
  associationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const triggerRef = useRef(false);

  const mutation = useSummarizeMeeting(associationId, {
    onSuccess: () => setState('done'),
    onError: () => setState('error'),
  });

  useEffect(() => {
    if (open && !triggerRef.current) {
      triggerRef.current = true;
      setState('loading');
      mutation.mutate(meeting.content);
    }
    if (!open) {
      triggerRef.current = false;
      setState('loading');
    }
  }, [open]);

  const result = mutation.data;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-primary/30 bg-primary/5 text-[11px] text-foreground hover:border-primary/50 hover:bg-primary/15 hover:text-foreground"
        >
          <ScrollText className="h-3 w-3 text-primary" />
          Özetle
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px]">
        {state === 'loading' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-500" />
                Toplantı özeti oluşturuluyor…
              </DialogTitle>
              <DialogDescription>
                &ldquo;{meeting.title}&rdquo; notu analiz ediliyor.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-[13px] text-muted-foreground">
                Yapay zeka özet çıkarıyor…
              </p>
            </div>
          </>
        )}

        {state === 'done' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-500" />
                Toplantı Özeti
              </DialogTitle>
              <DialogDescription>
                &ldquo;{meeting.title}&rdquo; toplantısının yapay zeka özeti
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Özet
                </h4>
                <p className="text-[13px] leading-relaxed">{result.summary}</p>
              </div>

              {result.decisions.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Alınan Kararlar
                  </h4>
                  <ul className="ml-4 list-disc space-y-1 text-[13px]">
                    {result.decisions.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.discussionTopics.length > 0 && (
                <div>
                  <h4 className="mb-1 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tartışma Konuları
                  </h4>
                  <ul className="ml-4 list-disc space-y-1 text-[13px]">
                    {result.discussionTopics.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-3 text-[12px] text-muted-foreground">
                {result.attendeeCount !== null && (
                  <span>Katılımcı sayısı: {result.attendeeCount}</span>
                )}
                <span>
                  Toplantı tonu:{' '}
                  <span className={TONE_LABEL[result.tone]?.color ?? ''}>
                    {TONE_LABEL[result.tone]?.label ?? result.tone}
                  </span>
                </span>
              </div>
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
                Özet oluşturulamadı
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