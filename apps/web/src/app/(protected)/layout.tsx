import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { AppShell } from './_components/app-shell';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <AppShell email={user.email ?? ''}>{children}</AppShell>;
}
