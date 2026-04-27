'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';

// Handles Supabase implicit-flow magic links where tokens arrive as URL fragments (#access_token=...).
// Server-side route handlers cannot read fragments, so this client component reads them and
// calls setSession() to establish the Supabase session before redirecting into the app.
export default function MagicLinkCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=auth_callback_failed');
      return;
    }

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        router.replace(error ? '/login?error=auth_callback_failed' : '/associations');
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Giriş yapılıyor…</p>
    </div>
  );
}
