import 'dotenv/config';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';

loadEnv({ path: path.resolve(__dirname, '..', '.env') });

const TARGET_USER_ID = process.env.SMOKE_USER_ID ?? 'cmoeyrn7a000co6hq83mcmh0w';
const TARGET_ASSOCIATION_ID =
  process.env.SMOKE_ASSOCIATION_ID ?? 'cmoeyqd820006o6hq9jbvvphd';
const QUEUE_NAME = 'task-reminders';
const REMINDER_DELAY_SEC = 90;
const DUE_DELAY_MIN = 10;

async function main() {
  const prisma = new PrismaClient();

  const account = await prisma.telegramAccount.findUnique({
    where: { userId: TARGET_USER_ID },
    select: { telegramId: true, createdAt: true },
  });
  if (!account) {
    console.error(`TelegramAccount missing for user ${TARGET_USER_ID}`);
    const linked = await prisma.telegramAccount.findMany({
      select: {
        telegramId: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            memberships: {
              where: { isActive: true, deletedAt: null },
              select: { associationId: true, role: true },
            },
          },
        },
      },
    });
    console.error(`\nLinked TelegramAccount rows (${linked.length}):`);
    for (const a of linked) {
      console.error(
        `  userId=${a.user.id} email=${a.user.email ?? '-'} telegramId=${a.telegramId.toString()} memberships=${JSON.stringify(a.user.memberships)}`,
      );
    }
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(
    `[ok] TelegramAccount: telegramId=${account.telegramId.toString()} linkedAt=${account.createdAt.toISOString()}`,
  );

  const membership = await prisma.associationMembership.findFirst({
    where: {
      userId: TARGET_USER_ID,
      associationId: TARGET_ASSOCIATION_ID,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, role: true },
  });
  if (!membership) {
    console.error(
      `User ${TARGET_USER_ID} is not active member of ${TARGET_ASSOCIATION_ID}`,
    );
    await prisma.$disconnect();
    process.exit(1);
  }
  console.log(`[ok] Membership: role=${membership.role}`);

  const now = Date.now();
  const reminderAt = new Date(now + REMINDER_DELAY_SEC * 1000);
  const dueDate = new Date(now + DUE_DELAY_MIN * 60 * 1000);

  const task = await prisma.task.create({
    data: {
      associationId: TARGET_ASSOCIATION_ID,
      title: '[Smoke] Telegram reminder probe',
      description: 'Auto-created by scripts/test-reminder.ts',
      assignedToUserId: TARGET_USER_ID,
      assignedById: TARGET_USER_ID,
      priority: 'HIGH',
      reminderFrequency: 'NONE',
      dueDate,
      reminderAt,
    },
    select: { id: true, reminderAt: true, dueDate: true },
  });
  console.log(
    `[ok] Task created: id=${task.id} reminderAt=${task.reminderAt!.toISOString()} dueDate=${task.dueDate!.toISOString()}`,
  );

  const connectionString =
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    'postgresql://ticketbot:ticketbot@localhost:5433/ticketbot';
  const boss = new PgBoss({ connectionString, schema: 'pgboss' });
  await boss.start();
  await boss.createQueue(QUEUE_NAME);

  const jobId = await boss.send(
    QUEUE_NAME,
    { type: 'REMINDER', taskId: task.id },
    {
      startAfter: reminderAt,
      retryLimit: 3,
      retryDelay: 60,
      retentionMinutes: 60,
      expireInMinutes: 15,
    },
  );

  if (jobId) {
    await prisma.task.update({
      where: { id: task.id },
      data: { reminderJobId: jobId },
    });
    console.log(
      `[ok] pg-boss REMINDER queued: jobId=${jobId} startAfter=${reminderAt.toISOString()}`,
    );
  } else {
    console.warn(`[warn] pg-boss send returned null (job not queued)`);
  }

  await boss.stop({ graceful: true, wait: true });
  await prisma.$disconnect();

  console.log(
    `\nExpect a Telegram message in ~${REMINDER_DELAY_SEC}s. Task id: ${task.id}`,
  );
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
