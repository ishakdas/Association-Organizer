import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import type { CookieOptions } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/associations';

  // Build the success redirect first so the Supabase client can write
  // session cookies directly onto it. Using next/headers cookies() here
  // does NOT work in Route Handlers — cookies set that way never reach
  // the browser when the handler returns a NextResponse.redirect().
  const successResponse = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            successResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // OAuth / PKCE authorization code flow (e.g. Google OAuth, password reset)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return successResponse;
  }

  // Magic link / OTP / invite flow
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) return successResponse;
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
