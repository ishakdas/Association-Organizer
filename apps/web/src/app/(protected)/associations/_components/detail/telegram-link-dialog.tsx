'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, RefreshCcw, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useGenerateMemberTelegramLink } from '../../_hooks/use-members';
import type { MemberResponse } from '@ticketbot/shared-validation';

const CODE_TTL_SECONDS = 10 * 60;
const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'dernek_organizer_bot';

export function TelegramLinkDialog({
  associationId,
  member,
  open,
  onOpenChange,
}: {
  associationId: string;
  member: MemberResponse | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useGenerateMemberTelegramLink(associationId);
  const [code, setCode] = useState<{ token: string; expiresAt: number } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const triggeredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !member) return;
    // Generate exactly once per (open, member) pair so re-renders don't
    // burn through fresh tokens.
    if (triggeredFor.current === member.id) return;
    triggeredFor.current = member.id;
    setCode(null);
    setCopied(false);
    mutation.mutate(member.id, {
      onSuccess: (data) => {
        setCode({
          token: data.token,
          expiresAt: new Date(data.expiresAt).getTime(),
        });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, member]);

  useEffect(() => {
    if (!open) {
      triggeredFor.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`/link ${code.token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  function regenerate() {
    if (!member) return;
    setCode(null);
    setCopied(false);
    mutation.mutate(member.id, {
      onSuccess: (data) => {
        setCode({
          token: data.token,
          expiresAt: new Date(data.expiresAt).getTime(),
        });
      },
    });
  }

  const remaining = code
    ? Math.max(0, Math.floor((code.expiresAt - now) / 1000))
    : 0;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const percent = code
    ? Math.max(0, Math.min(100, (remaining / CODE_TTL_SECONDS) * 100))
    : 0;
  const expired = code !== null && remaining === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Telegram bağlantı kodu</DialogTitle>
          <DialogDescription>
            {member
              ? `${member.user.fullName} adına tek kullanımlık bir kod üretildi. Kodu kişiye iletin; Telegram'da @${BOT_USERNAME} botuna /link KOD yazarak hesabını bağlayacak.`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {mutation.isPending && !code && (
          <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Kod oluşturuluyor…
          </div>
        )}

        {mutation.isError && !code && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
            {mutation.error?.message ?? 'Kod oluşturulamadı'}
          </div>
        )}

        {code && (
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Bağlantı Kodu
              </span>
              <div className="rounded-md border border-border bg-muted/30 p-3">
                <div className="break-all font-mono text-[14px] font-bold tracking-[0.06em] text-foreground">
                  {code.token}
                </div>
                <div className="mt-1 text-[11.5px] uppercase tracking-widest text-muted-foreground">
                  Tek kullanımlık · 10 dk
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium text-muted-foreground">
                  Kalan süre
                </span>
                <span className="font-mono tabular-nums text-foreground">
                  {minutes.toString().padStart(2, '0')}:
                  {seconds.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={copyCode} disabled={expired} className="flex-1">
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-success" />
                    Kopyalandı
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    /link komutunu kopyala
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={regenerate}
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : expired ? (
                  <>
                    <Zap className="h-4 w-4" />
                    Yeni kod üret
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-3.5 w-3.5" />
                    Yenile
                  </>
                )}
              </Button>
            </div>

            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Bu kod yalnızca bir kez kullanılabilir ve 10 dakika sonra geçersiz
              hale gelir. Kişi yeni bir telegram hesabı bağlamak isterse yeni
              bir kod üretebilirsiniz.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
