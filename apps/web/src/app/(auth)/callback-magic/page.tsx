'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';

// Handles Supabase implicit-flow invite/magic links where tokens arrive as URL fragments
// (#access_token=...). Server-side route handlers cannot read fragments, so this client
// component reads them, calls setSession(), then redirects to ?next= (or /associations).
export default function MagicLinkCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const error = params.get('error');
    const errorDescription = params.get('error_description');

    if (error) {
      const msg = errorDescription ? encodeURIComponent(errorDescription) : 'auth_callback_failed';
      router.replace(`/login?error=${msg}`);
      return;
    }

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=auth_callback_failed');
      return;
    }

    const next = searchParams.get('next') ?? '/associations';

    createClient()
      .auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error: sessionError }) => {
        router.replace(sessionError ? '/login?error=auth_callback_failed' : next);
      });
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Giriş yapılıyor…</p>
    </div>
  );
}
