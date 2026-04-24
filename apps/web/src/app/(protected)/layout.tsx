import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, BookUser, Ticket, FileText, Settings } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';

const nav = [
  { href: '/associations', label: 'Dernek Sicili', icon: BookUser },
  { href: '/organisation', label: 'Çalışma Alanları', icon: Building2 },
  { href: '/tickets', label: 'Görevler', icon: Ticket },
  { href: '/meeting-notes', label: 'Toplantı Notları', icon: FileText },
  { href: '/settings/telegram', label: 'Ayarlar', icon: Settings },
];

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-border bg-card px-4 py-6">
        <div className="mb-6 px-2">
          <h2 className="text-lg font-semibold">Dernek Organizer</h2>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
