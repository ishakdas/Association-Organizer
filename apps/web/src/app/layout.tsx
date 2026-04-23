import type { Metadata } from 'next';
import { QueryProvider } from '@/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dernek Yönetim Sistemi',
  description: 'Dernek sekreterlik ve üye yönetim platformu',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
