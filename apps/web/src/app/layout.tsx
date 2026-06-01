import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { QueryProvider } from '@/providers/query-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dernek Yönetim Sistemi',
  description: 'Dernek sekreterlik ve üye yönetim platformu',
};

// Anti-flaş: <head>'de, <body> boyanmadan ÖNCE çalışan blocking betik.
// next-themes betiğini <body> içine koyduğu için body arka planı bazen gündüz
// renginde boyanıp sonra geceye atlıyordu. Bu betik temayı kayıtlı değere göre
// (varsayılan: dark) ilk boyamadan önce uygular; next-themes aynı 'theme'
// anahtarını okuyup aynı sonucu verdiğinden çakışma olmaz.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('theme')||'dark';var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(t==='light'?'light':'dark');d.style.colorScheme=t==='light'?'light':'dark';}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Sunucu HTML'i varsayılan tema (gece) ile gelir; böylece ilk boyanan kare
    // zaten koyu olur, gündüz→gece flaşı olmaz. THEME_INIT betiği yalnızca
    // kullanıcı açık modu seçmişse, body boyanmadan önce sınıfı 'light' yapar.
    // suppressHydrationWarning: istemcide sınıf değişebileceği için SSR ile
    // farkı bastırır.
    <html lang="tr" className={`${jakarta.variable} dark`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      {/* suppressHydrationWarning on <body>: browser extensions (ColorZilla, Grammarly, etc.) inject attributes like cz-shortcut-listen on <body> after SSR, which would otherwise mismatch. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
        >
          <QueryProvider>{children}</QueryProvider>
          <Toaster position="top-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
