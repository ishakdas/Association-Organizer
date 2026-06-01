'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

/**
 * iOS tarzı gece/gündüz anahtarı. Sarı topuz ray üzerinde sola (gündüz) ↔
 * sağa (gece) kayar ve aktif modun simgesini taşır.
 * `mounted` koruması, SSR ile istemci arasındaki uyuşmazlığı (hydration) önler.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Sunucuda tema bilinmez; tüm dinamik değerleri `mounted`'a bağlayarak
  // sunucu ve ilk istemci render'ını eşitleriz (hydration hatası önlenir).
  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Gündüz moduna geç' : 'Gece moduna geç'}
      title={isDark ? 'Gündüz modu' : 'Gece modu'}
      className={cn(
        'relative inline-flex h-7 w-[56px] shrink-0 items-center rounded-full border border-border bg-muted shadow-inner transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {/* Ray ipuçları: solda güneş, sağda ay (sabit, soluk) */}
      <Sun className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
      <Moon className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-muted-foreground" />

      {/* Kayan topuz — kurumsal sarı, aktif modun simgesini taşır */}
      <span
        className={cn(
          'pointer-events-none relative z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-transform duration-300 ease-in-out',
          isDark ? 'translate-x-[30px]' : 'translate-x-0.5',
        )}
      >
        <Sun
          className={cn(
            'absolute h-3.5 w-3.5 transition-all duration-300 ease-in-out',
            isDark ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
          )}
        />
        <Moon
          className={cn(
            'absolute h-3.5 w-3.5 transition-all duration-300 ease-in-out',
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
          )}
        />
      </span>
    </button>
  );
}
