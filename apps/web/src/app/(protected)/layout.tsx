import { createServerClient } from '../../lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 220, padding: 20, borderRight: '1px solid #eee' }}>
        <h2 style={{ fontSize: 18 }}>TicketBot</h2>
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 20 }}>
          <li style={{ marginBottom: 12 }}><a href="/tickets">Tickets</a></li>
          <li style={{ marginBottom: 12 }}><a href="/meeting-notes">Meeting Notes</a></li>
          <li style={{ marginBottom: 12 }}><a href="/organisation">Organisation</a></li>
          <li style={{ marginBottom: 12 }}><a href="/settings/telegram">Settings</a></li>
        </ul>
      </nav>
      <main style={{ flex: 1, padding: 20 }}>
        {children}
      </main>
    </div>
  );
}
