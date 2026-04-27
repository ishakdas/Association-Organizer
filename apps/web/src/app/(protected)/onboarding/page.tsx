import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isSystemAdmin } from '@/lib/permissions';
import { OnboardingSlideshow } from './_components/onboarding-slideshow';

export default async function OnboardingPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  try {
    const me = await getMe(session.access_token);

    if (me.onboardingCompletedAt != null) {
      const cookieStore = await cookies();
      cookieStore.set('onboarding_done', '1', {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      });
      redirect('/associations');
    }

    return <OnboardingSlideshow isSystemAdmin={isSystemAdmin(me)} />;
  } catch {
    return <OnboardingSlideshow isSystemAdmin={false} />;
  }
}
