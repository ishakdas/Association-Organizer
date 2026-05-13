'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Crown,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { completeOnboarding, getMe } from '@/lib/api/me';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

interface Slide {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
  highlights: string[];
}

const ADMIN_SLIDES: Slide[] = [
  {
    icon: <Crown className="h-10 w-10" />,
    eyebrow: 'Genel Başkan Paneli',
    title: 'Yönetim Merkezine\nHoş Geldiniz',
    subtitle:
      'Tüm şubelerinizi, üyelerinizi ve faaliyetlerinizi tek bir güçlü platformdan yönetin.',
    highlights: [
      'Merkezi şube yönetimi ve sicil takibi',
      'Kapsamlı üye profilleri ve unvan kataloğu',
      'Gerçek zamanlı istatistik ve raporlar',
    ],
  },
  {
    icon: <Building2 className="h-10 w-10" />,
    eyebrow: 'Şube Ağı',
    title: 'Tüm Şubeleri\nTek Ekrandan Görün',
    subtitle:
      'Sisteme kayıtlı tüm dernekleri ve şubeleri yönetin, onaylayın ve takip edin.',
    highlights: [
      'Şube başvurularını onaylayın veya reddedin',
      'Her şubenin profiline ve üyelerine erişin',
      'Şube bazlı yöneticileri kolayca atayın',
    ],
  },
  {
    icon: <Users className="h-10 w-10" />,
    eyebrow: 'Üye Yönetimi',
    title: 'Kadro ve Üyeleri\nMerkezi Takip Edin',
    subtitle:
      'Tüm şubelerdeki üye bilgilerine, unvanlara ve iletişim detaylarına kolayca erişin.',
    highlights: [
      'Sistem genelinde unvan kataloğunu yönetin',
      'Üye iletişim bilgilerine anında erişin',
      'Rol bazlı yetki sistemiyle güvenli yapı',
    ],
  },
  {
    icon: <BarChart3 className="h-10 w-10" />,
    eyebrow: 'Analitik',
    title: 'İstatistik ve\nPerformans Analizi',
    subtitle:
      'Görev tamamlama oranları, toplantı katılımları ve üye dağılımlarını anlık izleyin.',
    highlights: [
      'Görev tamamlama ve gecikme oranları',
      'Toplantı katılım istatistikleri',
      'Şube bazlı karşılaştırmalı raporlar',
    ],
  },
];

const BRANCH_SLIDES: Slide[] = [
  {
    icon: <Sparkles className="h-10 w-10" />,
    eyebrow: 'Şube Yönetim Platformu',
    title: 'Şubenize\nHoş Geldiniz',
    subtitle:
      'Üyelerinizi, görevlerinizi ve toplantılarınızı tek platformdan kolayca yönetin.',
    highlights: [
      'Kolay ve hızlı üye yönetimi',
      'Akıllı görev atama ve takip sistemi',
      'Dijital toplantı kayıtları ve notlar',
    ],
  },
  {
    icon: <Users className="h-10 w-10" />,
    eyebrow: 'Üye Yönetimi',
    title: 'Üyelerinizi\nKolayca Yönetin',
    subtitle:
      'Şubenizdeki üyeleri ekleyin, unvan atayın ve iletişim bilgilerini güvenle saklayın.',
    highlights: [
      'Hızlı üye ekleme ve profil düzenleme',
      'Unvan ve rol ataması sistemi',
      'Telegram entegrasyonu ile kolay iletişim',
    ],
  },
  {
    icon: <ClipboardList className="h-10 w-10" />,
    eyebrow: 'Görev Takibi',
    title: 'Görevleri Atayın\nve Takip Edin',
    subtitle:
      'Üyelerinize görev tanımlayın, son tarih belirleyin ve ilerlemeyi gerçek zamanlı izleyin.',
    highlights: [
      'Kişiye özel görev atama',
      'Son tarih ve öncelik yönetimi',
      'Anlık görev durumu takibi',
    ],
  },
  {
    icon: <BookOpen className="h-10 w-10" />,
    eyebrow: 'Toplantı Yönetimi',
    title: 'Toplantıları\nDijitale Taşıyın',
    subtitle:
      'Toplantıları kaydedin, katılımcıları işaretleyin ve yapay zeka ile görev çıkarın.',
    highlights: [
      'Katılımcı listesi ve yoklama takibi',
      'Toplantı notları ve kararlar',
      'Yapay zeka destekli görev çıkarımı',
    ],
  },
  {
    icon: <MessageSquare className="h-10 w-10" />,
    eyebrow: 'Telegram Entegrasyonu',
    title: 'Üyenizi Telegram\'a\nBağlayın',
    subtitle:
      'Üyeleriniz Telegram hesaplarını sisteme bağlayarak bildirim alabilir ve bot üzerinden işlem yapabilir.',
    highlights: [
      'Ayarlar → Telegram bölümüne gidin',
      'Bağlantı kodu oluşturun ve kodu @YedimuinBot\'a gönderin',
      'Bağlantı tamamlandığında üye otomatik tanımlanır',
    ],
  },
];

export function OnboardingSlideshow({ isSystemAdmin }: { isSystemAdmin: boolean }) {
  const slides = isSystemAdmin ? ADMIN_SLIDES : BRANCH_SLIDES;
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const isLast = current === slides.length - 1;

  function goTo(index: number) {
    setVisible(false);
    setTimeout(() => {
      setCurrent(index);
      setVisible(true);
    }, 180);
  }

  function goNext() {
    if (!isLast) goTo(current + 1);
  }

  function goPrev() {
    if (current > 0) goTo(current - 1);
  }

  async function handleComplete() {
    // Set the gating cookie FIRST, synchronously. Middleware reads this
    // on every request — once it's there, /onboarding redirects stop
    // firing and any subsequent navigation succeeds even if the API
    // calls below hang or throw.
    document.cookie = 'onboarding_done=1; path=/; max-age=31536000; SameSite=Lax';
    setLoading(true);

    let redirectTo = '/dashboard';
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await completeOnboarding(session.access_token);
        const me = await getMe(session.access_token);
        const activeMemberships = me.memberships.filter((m) => m.isActive);
        if (activeMemberships.length === 1) {
          redirectTo = `/associations/${activeMemberships[0].associationId}`;
        }
      }
    } catch {
      // Non-blocking — the cookie + hard nav below still take the user
      // out of /onboarding even if these best-effort calls fail.
    }

    // Hard navigation (vs router.replace): guarantees the new request
    // hits middleware with the freshly-set cookie and rules out any
    // App Router caching that could keep the user on /onboarding.
    window.location.assign(redirectTo);
  }

  const slide = slides[current];
  const progress = ((current + 1) / slides.length) * 100;

  const accentClass =
    'bg-primary/15 text-primary ring-1 ring-primary/30';
  const checkClass = 'text-primary';

  const brandPanelStyle = {
    backgroundColor: '#0E0E0E',
    backgroundImage: [
      'linear-gradient(rgba(252,194,0,0.06), rgba(252,194,0,0))',
      'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 60px)',
      'repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 60px)',
    ].join(', '),
  };
  const radialGlowStyle = {
    background:
      'radial-gradient(circle at 30% 30%, rgba(252,194,0,0.18), rgba(252,194,0,0) 60%)',
  };

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop left brand panel ── */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:sticky lg:top-0 lg:h-screen',
          'lg:w-[42%] xl:w-[38%]',
          'relative overflow-hidden text-white',
        )}
        style={brandPanelStyle}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-[380px] w-[380px] rounded-full"
          style={radialGlowStyle}
        />

        {/* Brand */}
        <div className="relative z-10 p-8">
          <div className="flex items-center gap-3">
            <Image
              src="/yedihilal-logo.png"
              alt="YediHilal"
              width={32}
              height={45}
              className="h-11 w-auto"
              priority
            />
            <div>
              <div className="text-sm font-bold tracking-tight text-white">Dernek Organizer</div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-white/60">
                Sicil &amp; Üyelik
              </div>
            </div>
          </div>
        </div>

        {/* Icon display */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-10">
          <div
            className={cn(
              'mb-10 flex h-32 w-32 items-center justify-center rounded-3xl',
              'bg-primary text-primary-foreground shadow-2xl shadow-primary/30 ring-1 ring-primary/50',
              'transition-all duration-300',
              visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
            )}
          >
            {slide.icon}
          </div>

          {/* Slide dots */}
          <div className="flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === current ? 'w-10 bg-primary' : 'w-2.5 bg-white/30 hover:bg-white/50',
                )}
                aria-label={`Slayt ${i + 1}`}
              />
            ))}
          </div>

          <p className="mt-5 text-sm font-medium text-white/50">
            {current + 1} / {slides.length}
          </p>
        </div>

        {/* Footer label */}
        <div className="relative z-10 p-8 text-center">
          <span className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70">
            {isSystemAdmin ? 'Genel Başkan Paneli' : 'Şube Yönetim Paneli'}
          </span>
        </div>
      </aside>

      {/* ── Right content panel ── */}
      <main className="flex flex-1 flex-col bg-background">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Mobile brand header */}
        <div
          className="relative flex h-52 flex-col items-center justify-center gap-5 overflow-hidden text-white lg:hidden"
          style={brandPanelStyle}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-60 w-60 rounded-full"
            style={radialGlowStyle}
          />

          <div
            className={cn(
              'relative z-10 flex h-20 w-20 items-center justify-center rounded-2xl',
              'bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-primary/50',
              'transition-all duration-300',
              visible ? 'scale-100 opacity-100' : 'scale-90 opacity-0',
            )}
          >
            {slide.icon}
          </div>

          <div className="relative z-10 flex items-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === current ? 'w-8 bg-primary' : 'w-2 bg-white/35',
                )}
                aria-label={`Slayt ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Slide content */}
        <div className="flex flex-1 flex-col justify-center px-7 py-10 sm:px-12 lg:px-16 xl:px-20">
          <div
            className={cn(
              'max-w-lg space-y-7 transition-all duration-300',
              visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
            )}
          >
            {/* Eyebrow badge */}
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1',
                accentClass,
              )}
            >
              {slide.eyebrow}
            </span>

            {/* Title */}
            <h1 className="whitespace-pre-line text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              {slide.title}
            </h1>

            {/* Subtitle */}
            <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
              {slide.subtitle}
            </p>

            {/* Highlights */}
            <ul className="space-y-3">
              {slide.highlights.map((h, i) => (
                <li key={i} className="flex items-start gap-3">
                  <CheckCircle2
                    className={cn('mt-0.5 h-5 w-5 shrink-0', checkClass)}
                  />
                  <span className="text-sm text-muted-foreground">{h}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation */}
          <div className="mt-12 max-w-lg space-y-3">
            <div className="flex gap-3">
              {current > 0 && (
                <Button
                  variant="outline"
                  onClick={goPrev}
                  className="w-28 shrink-0"
                  size="lg"
                >
                  Geri
                </Button>
              )}

              {isLast ? (
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1"
                  size="lg"
                >
                  {loading ? 'Yükleniyor...' : 'Hadi Başlayalım'}
                  {!loading && <ChevronRight className="ml-1 h-4 w-4" />}
                </Button>
              ) : (
                <Button onClick={goNext} className="flex-1" size="lg">
                  Devam Et
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>

            {!isLast && (
              <div className="text-center">
                <button
                  onClick={handleComplete}
                  disabled={loading}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Tanıtımı atla
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
