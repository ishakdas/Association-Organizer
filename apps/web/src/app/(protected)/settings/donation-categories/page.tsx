import { notFound } from 'next/navigation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import type { DonationCategoryResponse } from '@ticketbot/shared-validation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { listAdminDonationCategories } from '@/lib/api/donation-categories';
import { isSystemAdmin } from '@/lib/permissions';
import { DonationCategoriesManager } from '../../admin/donation-categories/_components/donation-categories-manager';

export const metadata = { title: 'Bağış Türleri' };

export default async function SettingsDonationCategoriesPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) notFound();

  let me: AuthenticatedUser;
  try {
    me = await getMe(session.access_token);
  } catch {
    notFound();
  }

  if (!isSystemAdmin(me)) notFound();

  let initialData: DonationCategoryResponse[] = [];
  try {
    initialData = await listAdminDonationCategories(session.access_token);
  } catch {
    initialData = [];
  }

  return <DonationCategoriesManager initialData={initialData} />;
}
