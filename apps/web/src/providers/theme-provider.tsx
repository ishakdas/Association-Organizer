'use client';

import { useEffect } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ThemeProviderProps } from 'next-themes';

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  useEffect(() => {
    // İlk tema (gece/gündüz) animasyonsuz, anında boyanır; ilk boyamadan sonra
    // `theme-ready` eklenince geçiş animasyonları yalnızca kullanıcı düğmeye
    // bastığında devreye girer. Böylece yüklemede gündüz→gece flaşı olmaz.
    const id = requestAnimationFrame(() => {
      document.documentElement.classList.add('theme-ready');
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
