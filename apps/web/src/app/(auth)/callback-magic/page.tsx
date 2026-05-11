'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import { getMe } from '../../../lib/api/me';

// Reject anything that could escape this origin: protocol-relative `//host`,
// backslash-prefixed `/\host`, or anything not starting with `/` (absolute URLs,
// `@host` userinfo smuggling, etc). Falls back to /associations.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('//') || raw.startsWith('/\\')) return '/dashboard';
  return raw;
}

// Handles Supabase implicit-flow invite/magic links where tokens arrive as URL fragments
// (#access_token=...). Server-side route handlers cannot read fragments, so this client
// component reads them, calls setSession(), then redirects to ?next= (or /associations).
function MagicLinkCallbackInner() {
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

    const next = safeNext(searchParams.get('next'));

    (async () => {
      const supabase = createClient();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (sessionError) {
        router.replace('/login?error=auth_callback_failed');
        return;
      }

      // First-time invite users land here with mustChangePassword=true.
      // Force them through /reset-password before the original `next` so
      // they cannot continue with the temp Supabase password Supabase
      // assigned during the invite. Failures fall through to /reset-password
      // anyway — better to over-prompt than to skip the gate silently.
      let mustChange = true;
      try {
        const me = await getMe(accessToken);
        mustChange = me.mustChangePassword === true;
      } catch {
        // Fail closed: route through password set if we can't tell.
      }

      if (mustChange) {
        router.replace(`/reset-password?next=${encodeURIComponent(next)}`);
      } else {
        router.replace(next);
      }
    })();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">Giriş yapılıyor…</p>
    </div>
  );
}

// Next.js 15 requires <Suspense> around any client component that reads
// useSearchParams() — otherwise the prerender step bails out and fails
// the build. Wrap the inner component so the same loading UI shows during
// the brief client hydration window.
export default function MagicLinkCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-muted-foreground">Giriş yapılıyor…</p>
        </div>
      }
    >
      <MagicLinkCallbackInner />
    </Suspense>
  );
}
