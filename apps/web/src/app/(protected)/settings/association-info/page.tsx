import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { getAssociation } from '@/lib/api/associations';
import { activeMemberships, isSystemAdmin } from '@/lib/permissions';
import { GeneralSection } from '../../associations/_components/detail/general-section';

export const metadata = { title: 'Şube Bilgileri' };

export default async function AssociationInfoSettingsPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  let me = null;
  try {
    me = await getMe(session.access_token);
  } catch {
    redirect('/login');
  }

  if (isSystemAdmin(me)) redirect('/settings');

  const assocId = activeMemberships(me)[0]?.associationId;
  if (!assocId) redirect('/settings');

  let association = null;
  try {
    association = await getAssociation(session.access_token, assocId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-8 pb-10">
      <header className="space-y-5 border-b border-border pb-6">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-[12px] text-muted-foreground"
        >
          <Link href="/settings" className="font-medium hover:text-foreground">
            Ayarlar
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Şube Bilgileri</span>
        </nav>
        <div className="space-y-1.5">
          <span className="eyebrow">Şube</span>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
            Şube Bilgileri
          </h1>
          <p className="text-sm text-muted-foreground">
            Şubenizin genel bilgileri aşağıda görüntülenmektedir.
          </p>
        </div>
      </header>

      <GeneralSection a={association} />
    </div>
  );
}
