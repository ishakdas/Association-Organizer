import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { EVENT_REMINDERS_QUEUE } from './jobs.constants';
import { PgBossService } from './pgboss.service';
import { EventReminderScheduler } from './event-reminder.scheduler';

type PrismaMock = DeepMockProxy<PrismaClient>;

interface BossMock {
  send: jest.Mock;
  cancel: jest.Mock;
  work: jest.Mock;
  ensureStarted: jest.Mock;
}

const EVENT_ID = 'event-1';

function mkBoss(): BossMock {
  return {
    send: jest.fn(),
    cancel: jest.fn().mockResolvedValue(undefined),
    work: jest.fn().mockResolvedValue(undefined),
    ensureStarted: jest.fn().mockResolvedValue(undefined),
  };
}

describe('EventReminderScheduler', () => {
  let scheduler: EventReminderScheduler;
  let prisma: PrismaMock;
  let boss: BossMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    boss = mkBoss();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EventReminderScheduler,
        { provide: PrismaService, useValue: prisma },
        { provide: PgBossService, useValue: boss },
      ],
    }).compile();

    scheduler = moduleRef.get(EventReminderScheduler);
  });

  // --- scheduleEvent --------------------------------------------------------

  describe('scheduleEvent', () => {
    it('queues NOTIFY and persists notifyJobId for a future notifyAt', async () => {
      const notifyAt = new Date(Date.now() + 60 * 60_000);
      boss.send.mockResolvedValueOnce('notify-uuid');

      await scheduler.scheduleEvent({ id: EVENT_ID, notifyAt });

      expect(boss.send).toHaveBeenCalledWith(
        EVENT_REMINDERS_QUEUE,
        { eventId: EVENT_ID },
        expect.objectContaining({ startAfter: notifyAt }),
      );
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { notifyJobId: 'notify-uuid' },
      });
    });

    it('skips when notifyAt is in the past', async () => {
      await scheduler.scheduleEvent({
        id: EVENT_ID,
        notifyAt: new Date(Date.now() - 1000),
      });
      expect(boss.send).not.toHaveBeenCalled();
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('does not persist when pg-boss returns null', async () => {
      boss.send.mockResolvedValueOnce(null);
      await scheduler.scheduleEvent({
        id: EVENT_ID,
        notifyAt: new Date(Date.now() + 60_000),
      });
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  // --- cancelEvent ----------------------------------------------------------

  describe('cancelEvent', () => {
    it('cancels job and nulls notifyJobId when id present', async () => {
      prisma.event.findUnique.mockResolvedValue({
        notifyJobId: 'old-notify-uuid',
      } as never);

      await scheduler.cancelEvent(EVENT_ID);

      expect(boss.cancel).toHaveBeenCalledWith(
        EVENT_REMINDERS_QUEUE,
        'old-notify-uuid',
      );
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { notifyJobId: null },
      });
    });

    it('no-ops when notifyJobId is null', async () => {
      prisma.event.findUnique.mockResolvedValue({
        notifyJobId: null,
      } as never);

      await scheduler.cancelEvent(EVENT_ID);

      expect(boss.cancel).not.toHaveBeenCalled();
      expect(prisma.event.update).not.toHaveBeenCalled();
    });

    it('no-ops when event row is missing', async () => {
      prisma.event.findUnique.mockResolvedValue(null as never);
      await scheduler.cancelEvent(EVENT_ID);
      expect(boss.cancel).not.toHaveBeenCalled();
      expect(prisma.event.update).not.toHaveBeenCalled();
    });
  });

  // --- rescheduleEvent ------------------------------------------------------

  describe('rescheduleEvent', () => {
    it('cancels old then schedules new', async () => {
      prisma.event.findUnique.mockResolvedValue({
        notifyJobId: 'old-uuid',
      } as never);
      boss.send.mockResolvedValueOnce('new-uuid');

      const notifyAt = new Date(Date.now() + 60_000);
      await scheduler.rescheduleEvent({ id: EVENT_ID, notifyAt });

      expect(boss.cancel).toHaveBeenCalledWith(
        EVENT_REMINDERS_QUEUE,
        'old-uuid',
      );
      expect(boss.send).toHaveBeenCalledWith(
        EVENT_REMINDERS_QUEUE,
        { eventId: EVENT_ID },
        expect.objectContaining({ startAfter: notifyAt }),
      );
    });
  });

  // --- scheduleNextOccurrence ----------------------------------------------

  describe('scheduleNextOccurrence', () => {
    it('returns silently when nextAt is in the past', async () => {
      await scheduler.scheduleNextOccurrence(
        EVENT_ID,
        new Date(Date.now() - 1000),
      );
      expect(prisma.event.findUnique).not.toHaveBeenCalled();
      expect(boss.send).not.toHaveBeenCalled();
    });

    it('cancels existing then schedules new and persists new id', async () => {
      prisma.event.findUnique.mockResolvedValue({
        notifyJobId: 'prev-uuid',
      } as never);
      boss.send.mockResolvedValueOnce('next-uuid');

      const nextAt = new Date(Date.now() + 60_000);
      await scheduler.scheduleNextOccurrence(EVENT_ID, nextAt);

      expect(boss.cancel).toHaveBeenCalledWith(
        EVENT_REMINDERS_QUEUE,
        'prev-uuid',
      );
      expect(boss.send).toHaveBeenCalledWith(
        EVENT_REMINDERS_QUEUE,
        { eventId: EVENT_ID },
        expect.objectContaining({ startAfter: nextAt }),
      );
      expect(prisma.event.update).toHaveBeenCalledWith({
        where: { id: EVENT_ID },
        data: { notifyJobId: 'next-uuid' },
      });
    });

    it('skips cancel when no prior notifyJobId', async () => {
      prisma.event.findUnique.mockResolvedValue({
        notifyJobId: null,
      } as never);
      boss.send.mockResolvedValueOnce('next-uuid');

      await scheduler.scheduleNextOccurrence(
        EVENT_ID,
        new Date(Date.now() + 60_000),
      );

      expect(boss.cancel).not.toHaveBeenCalled();
      expect(boss.send).toHaveBeenCalledTimes(1);
    });
  });
});
