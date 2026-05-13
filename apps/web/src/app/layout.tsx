import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { QueryProvider } from '@/providers/query-provider';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${jakarta.variable} dark`}>
      {/* suppressHydrationWarning: browser extensions (ColorZilla, Grammarly, etc.) inject attributes like cz-shortcut-listen on <body> after SSR, which would otherwise mismatch. */}
      <body className="font-sans antialiased" suppressHydrationWarning>
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
