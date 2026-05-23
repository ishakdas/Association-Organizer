'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ExternalLink, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'yedi_hilal_organizator_bot';

function ConnectContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('t');

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-destructive text-sm">Geçersiz bağlantı. Lütfen yöneticinizle iletişime geçin.</p>
      </div>
    );
  }

  const deepLink = `https://t.me/${BOT_USERNAME}?start=link_${token}`;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MessageSquare className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-foreground">Telegram Hesabınızı Bağlayın</h1>
        <p className="text-sm text-muted-foreground">
          Dernek bildirimlerini Telegram üzerinden alabilmek için botu başlatın.
        </p>
      </div>

      <Button asChild className="w-full" size="lg">
        <a href={deepLink} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-2 h-4 w-4" />
          Telegram'da Aç
        </a>
      </Button>

      <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Buton çalışmazsa — Telegram&apos;da şu komutu yazın
        </p>
        <p className="break-all font-mono text-sm font-bold text-foreground">
          /link {token}
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Bu bağlantı tek kullanımlıktır ve 10 dakika içinde geçersiz hale gelir.
      </p>
    </div>
  );
}

export default function ConnectTelegramPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <Suspense fallback={<div className="text-center text-sm text-muted-foreground">Yükleniyor…</div>}>
          <ConnectContent />
        </Suspense>
      </div>
    </div>
  );
}
