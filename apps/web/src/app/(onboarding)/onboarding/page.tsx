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

  const me = await safeGetMe(session.access_token);

  if (!me) redirect('/associations');

  const admin = isSystemAdmin(me);
  if (me.onboardingCompletedAt != null) {
    redirect(admin ? '/dashboard' : '/associations');
  }

  return <OnboardingSlideshow isSystemAdmin={admin} />;
}

async function safeGetMe(token: string) {
  try {
    return await getMe(token);
  } catch {
    return null;
  }
}
