'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, Loader2, Mail, MessageSquare, RefreshCcw, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { generateTelegramLink, generateTelegramLinkWithEmail } from '@/lib/api/telegram';
import { getAccessToken } from '@/app/(protected)/associations/_hooks/use-associations';

const CODE_TTL_SECONDS = 10 * 60;
const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'yedi_hilal_organizator_bot';

interface TelegramLinkPanelProps {
  userEmail?: string | null;
  userFullName?: string;
}

export function TelegramLinkPanel({ userEmail }: TelegramLinkPanelProps) {
  const [code, setCode] = useState<{ token: string; expiresAt: number; deepLinkUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [isEmailLoading, setIsEmailLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [code]);

  async function generateCode() {
    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const data = await generateTelegramLink(token);
      setCode({
        token: data.token,
        expiresAt: new Date(data.expiresAt).getTime(),
        deepLinkUrl: data.deepLinkUrl,
      });
      setNow(Date.now());
    } catch (err) {
      toast.error((err as Error).message ?? 'Kod oluşturulamadı');
    } finally {
      setIsLoading(false);
    }
  }

  async function sendViaEmail() {
    if (!userEmail) {
      toast.error('Kayıtlı e-posta adresiniz yok');
      return;
    }
    setIsEmailLoading(true);
    try {
      const token = await getAccessToken();
      const data = await generateTelegramLinkWithEmail(token, userEmail);
      setCode({
        token: data.token,
        expiresAt: new Date(data.expiresAt).getTime(),
        deepLinkUrl: data.deepLinkUrl,
      });
      setNow(Date.now());
      toast.success(`${userEmail} adresine e-posta gönderildi`);
    } catch (err) {
      toast.error((err as Error).message ?? 'E-posta gönderilemedi');
    } finally {
      setIsEmailLoading(false);
    }
  }

  async function copyLink() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.deepLinkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  async function copyCommand() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`/link ${code.token}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
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

  if (!code) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <div className="text-[13px] font-semibold text-foreground">Telegram Bağlantı Kodu</div>
          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            Telegram bildirimlerini alabilmek için tek kullanımlık bir bağlantı kodu üretin.
            Kodu e-posta ile alabilir veya doğrudan Telegram&apos;da kullanabilirsiniz.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={generateCode} disabled={isLoading} className="flex-1">
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            Bağlantı kodu üret
          </Button>
          {userEmail && (
            <Button variant="outline" onClick={sendViaEmail} disabled={isEmailLoading} className="flex-1">
              {isEmailLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              E-posta ile gönder
            </Button>
          )}
        </div>
      </div>
    );
  }

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

      <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Telegram Deep Link
        </div>
        <a
          href={code.deepLinkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block break-all text-[13px] text-primary hover:underline"
        >
          {code.deepLinkUrl}
        </a>
        <div className="flex gap-2">
          <Button onClick={copyLink} disabled={expired} variant="outline" size="sm" className="flex-1">
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-green-600" />
                Kopyalandı
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Linki kopyala
              </>
            )}
          </Button>
          <Button onClick={copyCommand} disabled={expired} variant="outline" size="sm" className="flex-1">
            <MessageSquare className="h-3.5 w-3.5" />
            /link kopyala
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={generateCode} disabled={isLoading} className="flex-1">
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : expired ? (
            <>
              <Zap className="h-3.5 w-3.5" />
              Yeni kod üret
            </>
          ) : (
            <>
              <RefreshCcw className="h-3.5 w-3.5" />
              Yenile
            </>
          )}
        </Button>
        {userEmail && (
          <Button variant="outline" onClick={sendViaEmail} disabled={isEmailLoading} className="flex-1">
            {isEmailLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mail className="h-3.5 w-3.5" />
            )}
            E-posta ile gönder
          </Button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Bu kod yalnızca bir kez kullanılabilir ve 10 dakika sonra geçersiz hale gelir.
        <br />
        <strong>Botu Aç</strong> butonuna tıkladığınızda Telegram otomatik açılır ve bağlantı başlar.
        Alternatif olarak <strong>/link {code.token}</strong> komutunu @{BOT_USERNAME} botuna gönderebilirsiniz.
      </p>
    </div>
  );
}
