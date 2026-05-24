import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { TASK_REMINDERS_QUEUE } from './jobs.constants';
import { PgBossService } from './pgboss.service';
import { TaskReminderScheduler } from './task-reminder.scheduler';

type PrismaMock = DeepMockProxy<PrismaClient>;

interface BossMock {
  send: jest.Mock;
  cancel: jest.Mock;
  work: jest.Mock;
  ensureStarted: jest.Mock;
}

const TASK_ID = 'task-1';

function mkBoss(): BossMock {
  return {
    send: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue(undefined),
    ensureStarted: jest.fn().mockResolvedValue(undefined),
  };
}

describe('TaskReminderScheduler', () => {
  let scheduler: TaskReminderScheduler;
  let prisma: PrismaMock;
  let boss: BossMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    boss = mkBoss();

    const moduleRef = await Test.createTestingModule({
      providers: [
        TaskReminderScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: PgBossService, useValue: boss },
      ],
    }).compile();

    scheduler = moduleRef.get(TaskReminderScheduler);
  });

  // --- scheduleTask ---------------------------------------------------------

  describe('scheduleTask', () => {
    it('queues DUE + REMINDER and persists both job ids when both dates are in the future', async () => {
      const dueDate = new Date(Date.now() + 60 * 60 * 1000);
      const reminderAt = new Date(Date.now() + 10 * 60 * 1000);
      boss.send
        .mockResolvedValueOnce('due-uuid')
        .mockResolvedValueOnce('reminder-uuid');

      await scheduler.scheduleTask({ id: TASK_ID, dueDate, reminderAt });

      expect(boss.send).toHaveBeenCalledTimes(2);
      expect(boss.send).toHaveBeenNthCalledWith(
        1,
        TASK_REMINDERS_QUEUE,
        { type: 'DUE', taskId: TASK_ID },
        expect.objectContaining({ startAfter: dueDate }),
      );
      expect(boss.send).toHaveBeenNthCalledWith(
        2,
        TASK_REMINDERS_QUEUE,
        { type: 'REMINDER', taskId: TASK_ID },
        expect.objectContaining({ startAfter: reminderAt }),
      );
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: { dueJobId: 'due-uuid' },
      });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: { reminderJobId: 'reminder-uuid' },
      });
    });

    it('skips DUE when dueDate is in the past, still queues REMINDER if future', async () => {
      const pastDue = new Date(Date.now() - 1000);
      const reminderAt = new Date(Date.now() + 60_000);
      boss.send.mockResolvedValueOnce('reminder-uuid');

      await scheduler.scheduleTask({
        id: TASK_ID,
        dueDate: pastDue,
        reminderAt,
      });

      expect(boss.send).toHaveBeenCalledTimes(1);
      expect(boss.send).toHaveBeenCalledWith(
        TASK_REMINDERS_QUEUE,
        { type: 'REMINDER', taskId: TASK_ID },
        expect.objectContaining({ startAfter: reminderAt }),
      );
    });

    it('does nothing when both dates are null', async () => {
      await scheduler.scheduleTask({
        id: TASK_ID,
        dueDate: null,
        reminderAt: null,
      });
      expect(boss.send).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('does not persist when pg-boss returns null', async () => {
      boss.send.mockResolvedValueOnce(null);
      await scheduler.scheduleTask({
        id: TASK_ID,
        dueDate: new Date(Date.now() + 60_000),
        reminderAt: null,
      });
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  // --- cancelTask -----------------------------------------------------------

  describe('cancelTask', () => {
    it('cancels both jobs and nulls both columns when both ids present', async () => {
      prisma.task.findUnique.mockResolvedValue({
        dueJobId: 'due-uuid',
        reminderJobId: 'reminder-uuid',
      } as never);

      await scheduler.cancelTask(TASK_ID);

      expect(boss.cancel).toHaveBeenCalledWith(
        TASK_REMINDERS_QUEUE,
        'due-uuid',
      );
      expect(boss.cancel).toHaveBeenCalledWith(
        TASK_REMINDERS_QUEUE,
        'reminder-uuid',
      );
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: { dueJobId: null, reminderJobId: null },
      });
    });

    it('skips cancel + update when row has no job ids', async () => {
      prisma.task.findUnique.mockResolvedValue({
        dueJobId: null,
        reminderJobId: null,
      } as never);

      await scheduler.cancelTask(TASK_ID);

      expect(boss.cancel).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('no-ops when task row is missing', async () => {
      prisma.task.findUnique.mockResolvedValue(null as never);

      await scheduler.cancelTask(TASK_ID);

      expect(boss.cancel).not.toHaveBeenCalled();
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  // --- rescheduleTask -------------------------------------------------------

  describe('rescheduleTask', () => {
    it('calls cancelTask then scheduleTask in order', async () => {
      prisma.task.findUnique.mockResolvedValue({
        dueJobId: 'old-due',
        reminderJobId: null,
      } as never);
      boss.send.mockResolvedValueOnce('new-due-uuid');

      const dueDate = new Date(Date.now() + 60_000);
      await scheduler.rescheduleTask({
        id: TASK_ID,
        dueDate,
        reminderAt: null,
      });

      expect(boss.cancel).toHaveBeenCalledWith(TASK_REMINDERS_QUEUE, 'old-due');
      expect(boss.send).toHaveBeenCalledWith(
        TASK_REMINDERS_QUEUE,
        { type: 'DUE', taskId: TASK_ID },
        expect.objectContaining({ startAfter: dueDate }),
      );
    });
  });

  // --- scheduleNextReminder -------------------------------------------------

  describe('scheduleNextReminder', () => {
    it('returns silently when nextAt is in the past', async () => {
      const past = new Date(Date.now() - 1000);
      await scheduler.scheduleNextReminder(TASK_ID, past);
      expect(prisma.task.findUnique).not.toHaveBeenCalled();
      expect(boss.send).not.toHaveBeenCalled();
      expect(boss.cancel).not.toHaveBeenCalled();
    });

    it('cancels existing reminder before queuing the next one', async () => {
      prisma.task.findUnique.mockResolvedValue({
        reminderJobId: 'old-reminder',
      } as never);
      boss.send.mockResolvedValueOnce('new-reminder-uuid');

      const nextAt = new Date(Date.now() + 5 * 60_000);
      await scheduler.scheduleNextReminder(TASK_ID, nextAt);

      expect(boss.cancel).toHaveBeenCalledWith(
        TASK_REMINDERS_QUEUE,
        'old-reminder',
      );
      expect(boss.send).toHaveBeenCalledWith(
        TASK_REMINDERS_QUEUE,
        { type: 'REMINDER', taskId: TASK_ID },
        expect.objectContaining({ startAfter: nextAt }),
      );
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: TASK_ID },
        data: { reminderJobId: 'new-reminder-uuid' },
      });
    });

    it('skips cancel when no prior reminderJobId', async () => {
      prisma.task.findUnique.mockResolvedValue({
        reminderJobId: null,
      } as never);
      boss.send.mockResolvedValueOnce('new-reminder-uuid');

      const nextAt = new Date(Date.now() + 60_000);
      await scheduler.scheduleNextReminder(TASK_ID, nextAt);

      expect(boss.cancel).not.toHaveBeenCalled();
      expect(boss.send).toHaveBeenCalledTimes(1);
    });
  });
});
