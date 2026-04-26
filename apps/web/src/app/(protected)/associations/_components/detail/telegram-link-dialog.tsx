'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, MessageSquare, RefreshCcw, Unlink, Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useGenerateMemberTelegramLink, useUnlinkMemberTelegram } from '../../_hooks/use-members';
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
  const generateMutation = useGenerateMemberTelegramLink(associationId);
  const unlinkMutation = useUnlinkMemberTelegram(associationId);
  const [code, setCode] = useState<{ token: string; expiresAt: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const triggeredFor = useRef<string | null>(null);

  const isLinked = !!member?.user.telegramAccount;

  useEffect(() => {
    if (!open || !member) return;
    if (isLinked) return; // don't auto-generate if already linked
    // Generate exactly once per (open, member) pair so re-renders don't
    // burn through fresh tokens.
    if (triggeredFor.current === member.id) return;
    triggeredFor.current = member.id;
    setCode(null);
    setCopied(false);
    generateMutation.mutate(member.id, {
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
      setCode(null);
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
    generateMutation.mutate(member.id, {
      onSuccess: (data) => {
        setCode({
          token: data.token,
          expiresAt: new Date(data.expiresAt).getTime(),
        });
      },
    });
  }

  function handleUnlink() {
    if (!member) return;
    const ok = window.confirm(
      `${member.user.fullName} adlı kişinin Telegram bağlantısı kaldırılsın mı?`,
    );
    if (!ok) return;
    unlinkMutation.mutate(member.id, {
      onSuccess: () => onOpenChange(false),
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

  const telegram = member?.user.telegramAccount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Telegram Yönetimi</DialogTitle>
          <DialogDescription>
            {member ? `${member.user.fullName} adlı üyenin Telegram bağlantısını yönetin.` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLinked && telegram ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4 rounded-md border border-border bg-muted/30 px-4 py-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <MessageSquare className="h-4.5 w-4.5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-[14px] font-semibold text-foreground">
                  @{telegram.username ?? telegram.firstName ?? 'telegram'}
                </div>
                <div className="text-[12.5px] text-muted-foreground">
                  {new Date(telegram.createdAt).toLocaleString('tr-TR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  itibariyle bağlı
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-[13px] font-semibold text-foreground">
                  Yeni bağlantı kodu üret
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Üye farklı bir Telegram hesabı bağlamak istiyorsa yeni bir
                  bağlantı kodu oluşturun. Mevcut bağlantı yeni kod kullanıldığında otomatik güncellenir.
                </p>
              </div>
              {!code ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={regenerate}
                  disabled={generateMutation.isPending}
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5" />
                  )}
                  Bağlantı kodu üret
                </Button>
              ) : (
                <LinkCodePanel
                  code={code}
                  minutes={minutes}
                  seconds={seconds}
                  percent={percent}
                  expired={expired}
                  copied={copied}
                  isPending={generateMutation.isPending}
                  onCopy={copyCode}
                  onRegenerate={regenerate}
                />
              )}
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-[13px] font-semibold text-destructive">
                  Bağlantıyı kaldır
                </div>
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                  Üye artık Telegram üzerinden bildirim almayacak.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnlink}
                disabled={unlinkMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                {unlinkMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlink className="h-3.5 w-3.5" />
                )}
                Telegram bağlantısını kaldır
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogDescription className="sr-only">
              {member
                ? `${member.user.fullName} adına tek kullanımlık bir kod üretildi. Kodu kişiye iletin; Telegram'da @${BOT_USERNAME} botuna /link KOD yazarak hesabını bağlayacak.`
                : ''}
            </DialogDescription>

            {generateMutation.isPending && !code && (
              <div className="flex items-center gap-2 py-6 text-[13px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Kod oluşturuluyor…
              </div>
            )}

            {generateMutation.isError && !code && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13px] text-destructive">
                {generateMutation.error?.message ?? 'Kod oluşturulamadı'}
              </div>
            )}

            {code && (
              <LinkCodePanel
                code={code}
                minutes={minutes}
                seconds={seconds}
                percent={percent}
                expired={expired}
                copied={copied}
                isPending={generateMutation.isPending}
                onCopy={copyCode}
                onRegenerate={regenerate}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LinkCodePanel({
  code,
  minutes,
  seconds,
  percent,
  expired,
  copied,
  isPending,
  onCopy,
  onRegenerate,
}: {
  code: { token: string };
  minutes: number;
  seconds: number;
  percent: number;
  expired: boolean;
  copied: boolean;
  isPending: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
}) {
  return (
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
          <span className="font-medium text-muted-foreground">Kalan süre</span>
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
        <Button onClick={onCopy} disabled={expired} className="flex-1">
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
        <Button variant="outline" onClick={onRegenerate} disabled={isPending}>
          {isPending ? (
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
        Bu kod yalnızca bir kez kullanılabilir ve 10 dakika sonra geçersiz hale
        gelir.
      </p>
    </div>
  );
}
