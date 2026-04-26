import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { getMe } from '@/lib/api/me';
import { isTaskCreator } from '@/lib/permissions';
import { TasksOverview } from './_components/tasks-overview';

export default async function MyTasksPage() {
  const supabase = await createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  try {
    const me = await getMe(session.access_token);
    if (!isTaskCreator(me)) redirect('/associations');
  } catch {
    redirect('/associations');
  }

  return <TasksOverview />;
}
