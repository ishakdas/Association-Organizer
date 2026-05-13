import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16 text-white"
      style={{
        backgroundColor: '#0E0E0E',
        backgroundImage: [
          'linear-gradient(rgba(252,194,0,0.06), rgba(252,194,0,0))',
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 60px)',
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 60px)',
        ].join(', '),
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 30% 30%, rgba(252,194,0,0.22), rgba(252,194,0,0) 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-[420px] w-[420px] rounded-full"
        style={{
          background:
            'radial-gradient(circle at 70% 70%, rgba(252,194,0,0.12), rgba(252,194,0,0) 60%)',
        }}
      />

      <div className="relative z-10 mx-auto flex max-w-lg flex-col items-center gap-8 text-center">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/yedihilal-logo.png"
            alt="YediHilal"
            width={32}
            height={45}
            className="h-12 w-auto"
            priority
          />
          <div className="text-left leading-tight">
            <div className="text-sm font-bold tracking-tight text-white">
              Dernek Organizer
            </div>
            <div className="text-[10px] font-medium uppercase tracking-widest text-white/60">
              Sicil &amp; Üyelik
            </div>
          </div>
        </Link>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
            Hata 404
          </p>
          <h1 className="text-7xl font-extrabold leading-none tracking-tight text-primary sm:text-8xl">
            404
          </h1>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sayfa bulunamadı
          </h2>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-white/65">
            Aradığınız sayfa taşınmış, silinmiş veya hiç var olmamış olabilir.
            Adresi tekrar kontrol edin ya da ana sayfaya dönün.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link href="/">
              <Home className="h-4 w-4" />
              Ana sayfaya dön
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="gap-2 border-white/20 bg-white/5 text-white hover:border-white/40 hover:bg-white/10 hover:text-white"
          >
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              Giriş ekranı
            </Link>
          </Button>
        </div>

        <p className="text-[11px] uppercase tracking-widest text-white/40">
          © {new Date().getFullYear()} Dernek Organizer
        </p>
      </div>
    </div>
  );
}
