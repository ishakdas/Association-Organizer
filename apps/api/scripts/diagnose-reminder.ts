import 'dotenv/config';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const TARGET_EMAIL = process.argv[2] ?? 'ishak@aa.aa';
const QUEUE_NAME = 'task-reminders';

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
        `         freq=${t.reminderFrequency} lastNotifiedAt=${t.lastNotifiedAt?.toISOString() ?? '-'} notifiedTg=${t.notifiedViaTelegram}`,
    );
  }

  const redisUrl = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
  const host =
    redisUrl.hostname === 'localhost' ? '127.0.0.1' : redisUrl.hostname;
  const queue = new Queue(QUEUE_NAME, {
    connection: {
      host,
      port: Number(redisUrl.port || 6379),
      username: redisUrl.username || undefined,
      password: redisUrl.password || undefined,
      family: 4,
    },
  });

  const counts = await queue.getJobCounts(
    'waiting',
    'delayed',
    'active',
    'completed',
    'failed',
  );
  console.log(`\n[info] BullMQ queue "${QUEUE_NAME}" counts:`, counts);

  const delayed = await queue.getDelayed();
  const waiting = await queue.getWaiting();
  const failed = await queue.getFailed();

  console.log(`\n[info] Delayed jobs (${delayed.length}):`);
  for (const j of delayed.slice(0, 20)) {
    const fireAt = new Date((j.opts.delay ?? 0) + (j.timestamp ?? 0));
    console.log(
      `  jobId=${j.id} name=${j.name} data=${JSON.stringify(j.data)} fireAt=${fireAt.toISOString()}`,
    );
  }

  console.log(`\n[info] Waiting jobs (${waiting.length}):`);
  for (const j of waiting.slice(0, 20)) {
    console.log(`  jobId=${j.id} name=${j.name} data=${JSON.stringify(j.data)}`);
  }

  console.log(`\n[info] Failed jobs (${failed.length}):`);
  for (const j of failed.slice(0, 20)) {
    console.log(
      `  jobId=${j.id} name=${j.name} reason=${j.failedReason ?? '-'} data=${JSON.stringify(j.data)}`,
    );
  }

  await queue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
