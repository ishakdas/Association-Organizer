'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronRight,
  Copy,
  Loader2,
  MessageSquare,
  RefreshCcw,
  ShieldCheck,
  Unlink,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { createClient } from '@/lib/supabase/client';
import { getMe } from '@/lib/api/me';
import {
  generateTelegramLink,
  unlinkTelegramAccount,
} from '@/lib/api/telegram';
import type { AuthenticatedUser } from '@ticketbot/shared-types';

const CODE_TTL_SECONDS = 10 * 60;
const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'dernek_organizer_bot';

type LinkState =
  | { status: 'loading' }
  | { status: 'unlinked' }
  | { status: 'pending'; code: string; expiresAt: number }
  | { status: 'linked'; handle: string; linkedAt: Date };

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Oturum süresi dolmuş');
  return token;
}

function deriveStateFromUser(user: AuthenticatedUser): LinkState {
  if (user.telegramAccount) {
    return {
      status: 'linked',
      handle:
        user.telegramAccount.username ??
        user.telegramAccount.firstName ??
        'telegram',
      linkedAt: new Date(user.telegramAccount.linkedAt),
    };
  }
  return { status: 'unlinked' };
}

export default function TelegramSettingsPage() {
  const [state, setState] = useState<LinkState>({ status: 'loading' });
  const [generating, setGenerating] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refreshMe = useCallback(async () => {
    try {
      const token = await getToken();
      const user = await getMe(token);
      setState(deriveStateFromUser(user));
    } catch (err) {
      setError((err as Error).message);
      setState({ status: 'unlinked' });
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (state.status !== 'pending') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.status]);

  useEffect(() => {
    if (state.status === 'pending' && now >= state.expiresAt) {
      refreshMe();
    }
  }, [now, state, refreshMe]);

  async function generateCode() {
    setGenerating(true);
    setError(null);
    try {
      const token = await getToken();
      const { token: linkToken, expiresAt } = await generateTelegramLink(token);
      setState({
        status: 'pending',
        code: linkToken,
        expiresAt: new Date(expiresAt).getTime(),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(`/link ${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  }

  async function unlink() {
    setUnlinking(true);
    setError(null);
    try {
      const token = await getToken();
      await unlinkTelegramAccount(token);
      await refreshMe();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUnlinking(false);
    }
  }

  function cancelPending() {
    setState({ status: 'unlinked' });
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader />

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <StatusCard
            state={state}
            now={now}
            generating={generating}
            unlinking={unlinking}
            copied={copied}
            onGenerate={generateCode}
            onCopy={copyCode}
            onUnlink={unlink}
            onCancel={cancelPending}
          />
          <HowItWorksCard />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <SideInfoCard />
        </aside>
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <header className="space-y-5 border-b border-border pb-6">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1 text-[12px] text-muted-foreground"
      >
        <Link
          href="/associations"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Ayarlar
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-medium text-foreground">Telegram</span>
      </nav>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <span className="eyebrow">Entegrasyon</span>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            Telegram Bağlantısı
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Telegram hesabınızı platforma bağlayın; bildirimleri, görevleri ve
            kısa komutları sohbet penceresinden alın.
          </p>
        </div>
      </div>
    </header>
  );
}

function StatusCard({
  state,
  now,
  generating,
  unlinking,
  copied,
  onGenerate,
  onCopy,
  onUnlink,
  onCancel,
}: {
  state: LinkState;
  now: number;
  generating: boolean;
  unlinking: boolean;
  copied: boolean;
  onGenerate: () => void;
  onCopy: (code: string) => void;
  onUnlink: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            01
          </span>
          <Separator orientation="vertical" className="h-3" />
          <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            Bağlantı Durumu
          </h2>
        </div>
        {state.status === 'linked' && <Badge variant="success">Bağlı</Badge>}
        {state.status === 'pending' && <Badge variant="warning">Kod Aktif</Badge>}
        {state.status === 'unlinked' && <Badge variant="outline">Bağlı değil</Badge>}
      </header>

      <div className="px-5 py-6">
        {state.status === 'loading' && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Yükleniyor…
          </div>
        )}
        {state.status === 'unlinked' && (
          <UnlinkedPanel generating={generating} onGenerate={onGenerate} />
        )}
        {state.status === 'pending' && (
          <PendingPanel
            code={state.code}
            expiresAt={state.expiresAt}
            now={now}
            copied={copied}
            onCopy={() => onCopy(state.code)}
            onCancel={onCancel}
          />
        )}
        {state.status === 'linked' && (
          <LinkedPanel
            handle={state.handle}
            linkedAt={state.linkedAt}
            unlinking={unlinking}
            onUnlink={onUnlink}
          />
        )}
      </div>
    </section>
  );
}

function UnlinkedPanel({
  generating,
  onGenerate,
}: {
  generating: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-foreground">
          Telegram hesabınız henüz bağlı değil
        </h3>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Bir bağlantı kodu oluşturun ve Telegram bot&apos;una gönderin. Kod 10
          dakika içinde tek kullanımlık olarak geçerlidir.
        </p>
      </div>
      <Button onClick={onGenerate} disabled={generating} className="sm:shrink-0">
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Oluşturuluyor…
          </>
        ) : (
          <>
            <Zap className="h-4 w-4" />
            Bağlantı Kodu Oluştur
          </>
        )}
      </Button>
    </div>
  );
}

function PendingPanel({
  code,
  expiresAt,
  now,
  copied,
  onCopy,
  onCancel,
}: {
  code: string;
  expiresAt: number;
  now: number;
  copied: boolean;
  onCopy: () => void;
  onCancel: () => void;
}) {
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const percent = Math.max(0, Math.min(100, (remaining / CODE_TTL_SECONDS) * 100));

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <span className="eyebrow">Bağlantı Kodunuz</span>
        <p className="text-[13px] text-muted-foreground">
          Bu kodu Telegram üzerinde{' '}
          <span className="font-mono text-foreground">@{BOT_USERNAME}</span>{' '}
          botuna şu şekilde gönderin:{' '}
          <span className="font-mono text-foreground">/link {code.slice(0, 12)}…</span>
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-center sm:text-left">
          <div className="truncate font-mono text-[16px] font-bold tracking-[0.08em] text-foreground">
            {code}
          </div>
          <div className="mt-0.5 text-[11.5px] uppercase tracking-widest text-muted-foreground">
            Tek kullanımlık · Hassas bilgi
          </div>
        </div>
        <Button variant="outline" onClick={onCopy} className="shrink-0">
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

      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <RefreshCcw className="h-3.5 w-3.5" />
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

function LinkedPanel({
  handle,
  linkedAt,
  unlinking,
  onUnlink,
}: {
  handle: string;
  linkedAt: Date;
  unlinking: boolean;
  onUnlink: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div className="space-y-0.5">
          <h3 className="text-[15px] font-semibold text-foreground">@{handle}</h3>
          <p className="text-[12.5px] text-muted-foreground">
            {linkedAt.toLocaleString('tr-TR', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            itibariyle bağlı
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        onClick={onUnlink}
        disabled={unlinking}
        className="text-destructive"
      >
        {unlinking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Kaldırılıyor…
          </>
        ) : (
          <>
            <Unlink className="h-4 w-4" />
            Bağlantıyı kaldır
          </>
        )}
      </Button>
    </div>
  );
}

function HowItWorksCard() {
  const steps = [
    {
      title: 'Kod oluşturun',
      body: 'Bu sayfadan tek kullanımlık bir kod üretin.',
    },
    {
      title: "Bot'a gönderin",
      body: `Telegram'da @${BOT_USERNAME} botuna /link KODUNUZ yazın.`,
    },
    {
      title: 'Doğrulayın',
      body: 'Bot sizi tanıdığında bildirimler 30 gün boyunca aktif olur.',
    },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            02
          </span>
          <Separator orientation="vertical" className="h-3" />
          <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            Nasıl çalışır?
          </h2>
        </div>
      </header>
      <ol className="px-5 py-5">
        {steps.map((step, i) => (
          <li
            key={i}
            className="grid grid-cols-[40px_1fr] gap-3 py-3 [&+&]:border-t [&+&]:border-border/60"
          >
            <span className="font-mono text-[13px] font-semibold text-primary">
              0{i + 1}
            </span>
            <div>
              <div className="text-[13.5px] font-semibold text-foreground">
                {step.title}
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SideInfoCard() {
  return (
    <aside className="rounded-lg border border-border bg-muted/30">
      <header className="border-b border-border px-4 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Güvenlik
        </span>
      </header>
      <ul className="space-y-4 px-4 py-4 text-[12.5px] leading-relaxed">
        <SideRow
          icon={<ShieldCheck className="h-4 w-4" />}
          title="Tek kullanımlık kodlar"
          body="Her bağlantı kodu 10 dakika içinde yalnızca bir kez kullanılabilir."
        />
        <SideRow
          icon={<MessageSquare className="h-4 w-4" />}
          title="Yalnızca bildirim"
          body="Bot hesap verilerinize yazma erişimi olmadan okuma yapar."
        />
        <SideRow
          icon={<Unlink className="h-4 w-4" />}
          title="Her an bağlantıyı kaldırın"
          body="İstediğiniz zaman bağlantıyı sonlandırabilirsiniz."
        />
      </ul>
    </aside>
  );
}

function SideRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground">
        {icon}
      </span>
      <div className="space-y-0.5">
        <div className="text-[13px] font-semibold text-foreground">{title}</div>
        <p className="text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}
