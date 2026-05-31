import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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

  // getSession() reads the cookie locally — no Supabase Auth round-trip.
  // The layout re-checks the session and the Nest API verifies the JWT
  // signature, so a tampered cookie cannot reach protected data.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

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
    const url = request.nextUrl.clone();
    url.pathname = '/associations';
    return NextResponse.redirect(url);
  }

  // Cookie-only onboarding gate. /onboarding/page.tsx handles the admin-skip
  // case itself, so we avoid a per-navigation fetch to /auth/me here.
  if (
    user &&
    !pathname.startsWith('/onboarding') &&
    !pathname.startsWith('/auth/') &&
    !pathname.startsWith('/callback') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/reset-password') &&
    !pathname.startsWith('/dashboard')
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
