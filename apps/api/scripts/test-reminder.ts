import 'dotenv/config';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Queue } from 'bullmq';

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

  const reminderDelay = reminderAt.getTime() - Date.now();
  await queue.add(
    'REMINDER',
    { type: 'REMINDER', taskId: task.id },
    {
      jobId: `reminder-${task.id}`,
      delay: reminderDelay,
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    },
  );
  console.log(
    `[ok] BullMQ REMINDER queued: jobId=reminder-${task.id} delay=${reminderDelay}ms (~${Math.round(reminderDelay / 1000)}s)`,
  );

  await queue.close();
  await prisma.$disconnect();

  console.log(
    `\nExpect a Telegram message in ~${REMINDER_DELAY_SEC}s. Task id: ${task.id}`,
  );
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
