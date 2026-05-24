import 'dotenv/config';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const TARGET_EMAIL = process.argv[2] ?? 'ishak@aa.aa';

async function main() {
  const prisma = new PrismaClient();

  console.log(`\n=== Diagnostic for ${TARGET_EMAIL} ===\n`);

  const user = await prisma.user.findFirst({
    where: { email: TARGET_EMAIL },
    select: {
      id: true,
      email: true,
      fullName: true,
      supabaseUserId: true,
      memberships: {
        where: { isActive: true, deletedAt: null },
        select: { associationId: true, role: true },
      },
    },
  });

  if (!user) {
    console.error(`[FAIL] No User row with email=${TARGET_EMAIL}`);
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(
    `[ok] User: id=${user.id} name="${user.fullName}" supabaseUserId=${user.supabaseUserId ?? 'null'}`,
  );
  console.log(`     memberships=${JSON.stringify(user.memberships)}`);

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: user.id },
    select: { telegramId: true, username: true, createdAt: true },
  });
  if (!account) {
    console.log(`\n[FAIL] No TelegramAccount for user ${user.id}`);
    const allLinks = await prisma.telegramAccount.findMany({
      select: {
        telegramId: true,
        username: true,
        user: { select: { id: true, email: true } },
      },
    });
    console.log(`       Existing TelegramAccount rows in DB (${allLinks.length}):`);
    for (const a of allLinks) {
      console.log(
        `         userId=${a.user.id} email=${a.user.email ?? '-'} telegramId=${a.telegramId.toString()} username=${a.username ?? '-'}`,
      );
    }
  } else {
    console.log(
      `\n[ok] TelegramAccount: telegramId=${account.telegramId.toString()} username=${account.username ?? '-'} linkedAt=${account.createdAt.toISOString()}`,
    );
  }

  const tasks = await prisma.task.findMany({
    where: {
      OR: [{ assignedToUserId: user.id }, { assignedById: user.id }],
      deletedAt: null,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      status: true,
      assignedToUserId: true,
      assignedById: true,
      reminderAt: true,
      dueDate: true,
      reminderFrequency: true,
      lastNotifiedAt: true,
      notifiedViaTelegram: true,
      dueJobId: true,
      reminderJobId: true,
      createdAt: true,
    },
  });
  console.log(`\n[info] Last ${tasks.length} task(s) involving this user:`);
  const now = Date.now();
  for (const t of tasks) {
    const reminderState = t.reminderAt
      ? t.reminderAt.getTime() > now
        ? `future (in ${Math.round((t.reminderAt.getTime() - now) / 1000)}s)`
        : `PAST by ${Math.round((now - t.reminderAt.getTime()) / 1000)}s`
      : 'null';
    const dueState = t.dueDate
      ? t.dueDate.getTime() > now
        ? `future (in ${Math.round((t.dueDate.getTime() - now) / 60000)}m)`
        : `PAST by ${Math.round((now - t.dueDate.getTime()) / 60000)}m`
      : 'null';
    const role = t.assignedToUserId === user.id ? 'ASSIGNEE' : 'CREATOR';
    console.log(
      `  [${role}] id=${t.id} title="${t.title}" status=${t.status}\n` +
        `         reminderAt=${t.reminderAt?.toISOString() ?? '-'} (${reminderState})\n` +
        `         dueDate   =${t.dueDate?.toISOString() ?? '-'} (${dueState})\n` +
        `         freq=${t.reminderFrequency} lastNotifiedAt=${t.lastNotifiedAt?.toISOString() ?? '-'} notifiedTg=${t.notifiedViaTelegram}\n` +
        `         pgboss: dueJobId=${t.dueJobId ?? '-'} reminderJobId=${t.reminderJobId ?? '-'}`,
    );
  }

  // pg-boss bookkeeping: query the `pgboss.job` table directly to see what
  // is queued. Replaces the old BullMQ `getJobCounts` / `getDelayed` /
  // `getWaiting` / `getFailed` calls.
  const counts = await prisma.$queryRawUnsafe<
    { state: string; queue_name: string; n: bigint }[]
  >(
    `SELECT state, name AS queue_name, count(*)::bigint AS n
     FROM pgboss.job
     WHERE name IN ('task-reminders', 'event-reminders')
     GROUP BY state, name
     ORDER BY name, state`,
  );
  console.log(`\n[info] pg-boss job counts by state:`);
  for (const row of counts) {
    console.log(`  ${row.queue_name} / ${row.state}: ${row.n.toString()}`);
  }

  const upcoming = await prisma.$queryRawUnsafe<
    {
      id: string;
      name: string;
      state: string;
      data: unknown;
      startafter: Date;
    }[]
  >(
    `SELECT id, name, state, data, startafter
     FROM pgboss.job
     WHERE name = 'task-reminders'
       AND state IN ('created', 'retry')
     ORDER BY startafter ASC
     LIMIT 20`,
  );
  console.log(`\n[info] Upcoming task-reminders jobs (${upcoming.length}):`);
  for (const j of upcoming) {
    console.log(
      `  id=${j.id} state=${j.state} startAfter=${j.startafter.toISOString()} data=${JSON.stringify(j.data)}`,
    );
  }

  const failed = await prisma.$queryRawUnsafe<
    { id: string; name: string; data: unknown; output: unknown }[]
  >(
    `SELECT id, name, data, output
     FROM pgboss.job
     WHERE name = 'task-reminders'
       AND state = 'failed'
     ORDER BY completedon DESC NULLS LAST
     LIMIT 20`,
  );
  console.log(`\n[info] Failed task-reminders jobs (${failed.length}):`);
  for (const j of failed) {
    console.log(
      `  id=${j.id} data=${JSON.stringify(j.data)} output=${JSON.stringify(j.output)}`,
    );
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
