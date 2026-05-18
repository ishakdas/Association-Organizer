import Link from 'next/link';
import {
  ChevronRight,
  MessageSquare,
  Send,
  ShieldCheck,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { TelegramLinkPanel } from './_components/telegram-link-panel';

const BOT_USERNAME =
  process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? 'yedi_hilal_organizator_bot';

export default async function TelegramSettingsPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let user = null;
  if (session?.access_token) {
    try {
      user = await getMe(session.access_token);
    } catch {
      user = null;
    }
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <SelfServiceCard
            userEmail={user?.email}
            userFullName={user?.fullName}
          />
          <MemberGuideCard />
          <HowItWorksCard />
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          <SideInfoCard />
        </aside>
      </div>
    </div>
  );
}

function SelfServiceCard({
  userEmail,
  userFullName,
}: {
  userEmail?: string | null;
  userFullName?: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Bağlantı
          </span>
          <Separator orientation="vertical" className="h-3" />
          <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            Telegram Hesabınızı Bağlayın
          </h2>
        </div>
      </header>
      <div className="px-5 py-5">
        <TelegramLinkPanel userEmail={userEmail} userFullName={userFullName} />
      </div>
    </section>
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
          href="/settings"
          className="font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Ayarlar
        </Link>
        <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
        <span className="font-medium text-foreground">Telegram Bildirimleri</span>
      </nav>
      <div className="space-y-1.5">
        <span className="eyebrow">Entegrasyon</span>
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
          Telegram Bildirimleri
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          Üyelerinizin görev hatırlatıcıları ve duyuruları Telegram üzerinden alabilmesi için
          izlemesi gereken adımlar.
        </p>
      </div>
    </header>
  );
}

function MemberGuideCard() {
  const steps = [
    {
      step: '01',
      icon: <Smartphone className="h-4 w-4" />,
      title: 'Yöneticinizden bağlantı daveti alın',
      body: 'Yönetici, Üyeler sayfasından ilgili üyenin yanındaki Telegram simgesine tıklayarak "E-posta ile gönder" butonunu kullanır. Üye, Telegram deep link içeren bir davet e-postası alır.',
    },
    {
      step: '02',
      icon: <Send className="h-4 w-4" />,
      title: 'E-postadaki "Botu Aç" butonuna tıklayın',
      body: `E-postadaki butona tıkladığınızda Telegram otomatik açılır ve @${BOT_USERNAME} botuna bağlanırsınız. Alternatif olarak e-postadaki kodu kopyalayıp bota /link KODU şeklinde gönderebilirsiniz.`,
    },
    {
      step: '03',
      icon: <UserCheck className="h-4 w-4" />,
      title: 'Telefonunuzu paylaşın',
      body: 'Bot, hesap güvenliği için telefon numaranızı paylaşmanızı isteyecektir. "Telefonu paylaş" butonuna dokunduğunuzda bağlantı tamamlanır ve bildirimler aktif hale gelir.',
    },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Rehber
          </span>
          <Separator orientation="vertical" className="h-3" />
          <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            Üye Telegram Bağlantısı — Adım Adım
          </h2>
        </div>
      </header>
      <ol className="px-5 py-5">
        {steps.map((s, i) => (
          <li
            key={i}
            className="grid grid-cols-[56px_1fr] gap-3 py-4 [&+&]:border-t [&+&]:border-border/60"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                {s.icon}
              </span>
              <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                {s.step}
              </span>
            </div>
            <div className="pt-1">
              <div className="text-[13.5px] font-semibold text-foreground">{s.title}</div>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function HowItWorksCard() {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-primary">
            Bilgi
          </span>
          <Separator orientation="vertical" className="h-3" />
          <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">
            Bildirimler nasıl çalışır?
          </h2>
        </div>
      </header>
      <div className="space-y-4 px-5 py-5 text-[13px] text-muted-foreground leading-relaxed">
        <p>
          Telegram hesabını platforma bağlayan üyeler, kendilerine atanan görevler için
          otomatik hatırlatıcı mesajları alır. Bot, görev son tarihi yaklaştığında
          @{BOT_USERNAME} üzerinden mesaj gönderir.
        </p>
        <p>
          Bağlantı <strong className="text-foreground">30 gün</strong> boyunca geçerlidir.
          Bu süre dolduğunda üyenin aynı işlemi tekrarlaması yeterlidir. Yönetici her
          zaman Üyeler sayfasından yeni bir bağlantı kodu üretebilir.
        </p>
        <p>
          Telegram hesabı bağlı olmayan üyeler bildirim almaz; ancak görevleri platform
          üzerinden görmeye devam eder.
        </p>
      </div>
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
          body="Bot hesap verilerine yazma erişimi olmadan yalnızca bildirim gönderir."
        />
        <SideRow
          icon={<UserCheck className="h-4 w-4" />}
          title="Her an bağlantıyı kaldırın"
          body="Yönetici, Üyeler sayfasından üyenin Telegram bağlantısını istediği zaman kaldırabilir."
        />
      </ul>
    </aside>
  );
}

function SideRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
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
