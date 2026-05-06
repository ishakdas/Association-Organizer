'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Loader2,
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
import { Badge } from '@/components/ui/badge';
import { useSuggestAgenda } from '../../_hooks/use-meetings';

const PRIORITY_STYLE: Record<string, string> = {
  YUKSEK: 'bg-destructive/10 text-destructive border-destructive/20',
  ORTA: 'bg-primary/10 text-primary border-primary/20',
  DUSUK: 'bg-muted text-muted-foreground border-border',
};

const PRIORITY_LABEL: Record<string, string> = {
  YUKSEK: 'Yüksek',
  ORTA: 'Orta',
  DUSUK: 'Düşük',
};

const CATEGORY_LABEL: Record<string, string> = {
  'inandıcı_karar': 'Karar',
  'bütçe': 'Bütçe',
  'etkinlik': 'Etkinlik',
  'dış_iliskiler': 'Dış İlişkiler',
  'üye_yönetimi': 'Üye Yönetimi',
  'idari': 'İdari',
  'diğer': 'Diğer',
};

export function SuggestAgendaDialog({
  meeting,
  associationId,
}: {
  meeting: MeetingNoteResponse;
  associationId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<'loading' | 'done' | 'error'>('loading');
  const triggerRef = useRef(false);

  const mutation = useSuggestAgenda(associationId, {
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
        <Button variant="outline" size="sm" className="h-7 gap-1.5 text-[11px]">
          <Sparkles className="h-3 w-3 text-emerald-500" />
          Gündem Öner
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[640px]">
        {state === 'loading' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Gündem önerisi oluşturuluyor…
              </DialogTitle>
              <DialogDescription>
                &ldquo;{meeting.title}&rdquo; notundan gündem maddeleri çıkarılıyor.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <p className="text-[13px] text-muted-foreground">
                Yapay zeka gündem önerileri oluşturuyor…
              </p>
            </div>
          </>
        )}

        {state === 'done' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                Gündem Önerileri
              </DialogTitle>
              <DialogDescription>
                {result.agendaItems.length > 0
                  ? `${result.agendaItems.length} gündem maddesi önerildi`
                  : 'Gündem maddesi önerilemedi'}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {result.agendaItems.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-md border border-border bg-muted/20 p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {idx + 1}
                        </span>
                        <h4 className="text-[13px] font-semibold">{item.title}</h4>
                      </div>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {item.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={PRIORITY_STYLE[item.priority] ?? ''}
                    >
                      {PRIORITY_LABEL[item.priority] ?? item.priority}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </Badge>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {item.estimatedDuration} dk
                    </span>
                  </div>
                </div>
              ))}
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
                Gündem önerisi oluşturulamadı
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