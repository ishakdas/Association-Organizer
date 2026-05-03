import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { type AuthenticatedUser } from '@ticketbot/shared-types';

async function getRedirectPath(
  supabase: ReturnType<typeof createServerClient>,
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return '/login';

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return '/associations';
    const user: AuthenticatedUser = await res.json();
    if (user.systemRole === 'SYSTEM_ADMIN') return '/dashboard';
    const active = user.memberships.filter((m) => m.isActive);
    if (active.length > 0) return `/associations/${active[0].associationId}`;
    return '/settings';
  } catch {
    return '/associations';
  }
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (
    !user &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/callback') &&
    !pathname.startsWith('/reset-password')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith('/login')) {
    const dest = await getRedirectPath(supabase);
    const url = request.nextUrl.clone();
    url.pathname = dest;
    return NextResponse.redirect(url);
  }

  // Onboarding gate: authenticated + not yet onboarded + not on onboarding/auth routes
  if (
    user &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/auth/') &&
    !pathname.startsWith('/callback') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/reset-password')
  ) {
    const done = request.cookies.get('onboarding_done')?.value === '1';
    if (!done) {
      const url = request.nextUrl.clone();
      url.pathname = '/onboarding';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
