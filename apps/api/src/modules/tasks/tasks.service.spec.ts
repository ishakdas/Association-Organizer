import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { BotService } from 'bot';
import { TasksService } from './tasks.service';
import { TaskReminderScheduler } from '../jobs/task-reminder.scheduler';
import { IcsTokenService } from './ics-token.service';

type PrismaMock = DeepMockProxy<PrismaClient>;

const ASSOC = 'assoc-1';
const ADMIN_USER = {
  id: 'admin-1',
  systemRole: 'SYSTEM_ADMIN',
  memberships: [],
} as any;
const SECRETARY_USER = {
  id: 'sec-1',
  systemRole: null,
  memberships: [
    {
      id: 'mem-sec',
      associationId: ASSOC,
      role: 'ASSOCIATION_SECRETARY',
      isActive: true,
    },
  ],
} as any;
const MEMBER_USER = {
  id: 'mem-1',
  systemRole: null,
  memberships: [
    {
      id: 'mem-mem',
      associationId: ASSOC,
      role: 'ASSOCIATION_MEMBER',
      isActive: true,
    },
  ],
} as any;

const sampleTask = {
  id: 'task-1',
  associationId: ASSOC,
  title: 'Bağış toplama',
  description: null,
  assignedToUserId: 'mem-1',
  assignedById: 'sec-1',
  assignedBy: { id: 'sec-1', fullName: 'Sekreter' },
  watcherUserId: null,
  watcher: null,
  status: 'PENDING',
  priority: 'MEDIUM',
  dueDate: null,
  reminderAt: null,
  reminderFrequency: 'NONE',
  completedAt: null,
  createdAt: new Date('2026-04-24'),
  updatedAt: new Date('2026-04-24'),
  deletedAt: null,
};

const validInput = {
  title: 'Bağış toplama',
  assignedToUserId: 'mem-1',
  priority: 'MEDIUM' as const,
  reminderFrequency: 'NONE' as const,
};

describe('TasksService', () => {
  let service: TasksService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    // service.list uses $transaction([findMany, count]) — resolve as array.
    prisma.$transaction.mockImplementation(async (input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      // callback form (used elsewhere): pass the same client through.
      return input(prisma);
    });
    // Default count to 0 unless overridden in a test.
    prisma.task.count.mockResolvedValue(0 as never);

    const schedulerMock = {
      scheduleTask: jest.fn().mockResolvedValue(undefined),
      cancelTask: jest.fn().mockResolvedValue(undefined),
      rescheduleTask: jest.fn().mockResolvedValue(undefined),
      scheduleNextReminder: jest.fn().mockResolvedValue(undefined),
    };
    const botMock = {
      sendToUser: jest.fn().mockResolvedValue(false),
    };
    const icsTokensMock = {
      signTaskIcsUrl: jest.fn().mockReturnValue('https://example.test/ics'),
      verifyTaskIcsToken: jest.fn().mockReturnValue(true),
      uidDomain: jest.fn().mockReturnValue('example.test'),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: TaskReminderScheduler, useValue: schedulerMock },
        { provide: BotService, useValue: botMock },
        { provide: IcsTokenService, useValue: icsTokensMock },
      ],
    }).compile();
    service = moduleRef.get(TasksService);
  });

  describe('create', () => {
    it('rejects with BadRequest when assignee is not an active member of the association', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(null);

      await expect(
        service.create(ASSOC, validInput, SECRETARY_USER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('rejects with BadRequest when assignee has no linked Telegram account', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({
        id: 'mem-mem',
      } as never);
      prisma.telegramAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.create(ASSOC, validInput, SECRETARY_USER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.task.create).not.toHaveBeenCalled();
    });

    it('creates the task and stamps assignedById from the authenticated user', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({
        id: 'mem-mem',
      } as never);
      prisma.telegramAccount.findUnique.mockResolvedValue({
        userId: 'mem-1',
      } as never);
      prisma.task.create.mockResolvedValue(sampleTask as never);

      const result = await service.create(ASSOC, validInput, SECRETARY_USER);

      expect(prisma.associationMembership.findFirst).toHaveBeenCalledWith({
        where: {
          associationId: ASSOC,
          userId: 'mem-1',
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            associationId: ASSOC,
            assignedToUserId: 'mem-1',
            assignedById: SECRETARY_USER.id,
            title: 'Bağış toplama',
            priority: 'MEDIUM',
            reminderFrequency: 'NONE',
          }),
        }),
      );
      expect(result).toEqual(sampleTask);
    });

    it('coerces optional dueDate / reminderAt strings to Date', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({
        id: 'mem-mem',
      } as never);
      prisma.telegramAccount.findUnique.mockResolvedValue({
        userId: 'mem-1',
      } as never);
      prisma.task.create.mockResolvedValue(sampleTask as never);

      await service.create(
        ASSOC,
        {
          ...validInput,
          dueDate: '2026-05-01T00:00:00.000Z',
          reminderAt: '2026-04-30T09:00:00.000Z',
        },
        SECRETARY_USER,
      );

      const arg = prisma.task.create.mock.calls[0][0];
      expect((arg.data as any).dueDate).toBeInstanceOf(Date);
      expect((arg.data as any).reminderAt).toBeInstanceOf(Date);
    });
  });

  describe('list', () => {
    it('admin/secretary: returns all dernek tasks (no assignee restriction)', async () => {
      prisma.task.findMany.mockResolvedValue([sampleTask] as never);

      await service.list(ASSOC, { page: 1, pageSize: 20 }, SECRETARY_USER);

      const arg = prisma.task.findMany.mock.calls[0][0];
      expect((arg as any).where).toMatchObject({
        associationId: ASSOC,
        deletedAt: null,
      });
      expect((arg as any).where.assignedToUserId).toBeUndefined();
    });

    it('member: scopes the list to their own assignments', async () => {
      prisma.task.findMany.mockResolvedValue([] as never);

      await service.list(ASSOC, { page: 1, pageSize: 20 }, MEMBER_USER);

      const arg = prisma.task.findMany.mock.calls[0][0];
      expect((arg as any).where.assignedToUserId).toBe(MEMBER_USER.id);
    });

    it('honors status + assignedToUserId query filters when provided', async () => {
      prisma.task.findMany.mockResolvedValue([] as never);

      await service.list(
        ASSOC,
        {
          status: 'COMPLETED',
          assignedToUserId: 'mem-1',
          page: 1,
          pageSize: 20,
        },
        ADMIN_USER,
      );

      const arg = prisma.task.findMany.mock.calls[0][0];
      expect((arg as any).where).toMatchObject({
        associationId: ASSOC,
        status: 'COMPLETED',
        assignedToUserId: 'mem-1',
      });
    });
  });

  describe('updateStatus', () => {
    it('throws NotFound when the task does not exist', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus('missing', { status: 'IN_PROGRESS' }, ADMIN_USER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids users without an active membership in the task association', async () => {
      // Task belongs to ASSOC but user is in a different one.
      prisma.task.findFirst.mockResolvedValue({
        ...sampleTask,
        associationId: 'other-assoc',
      } as never);

      await expect(
        service.updateStatus(sampleTask.id, { status: 'IN_PROGRESS' }, MEMBER_USER),
      ).rejects.toThrow(/yetki/i);
    });

    it('updates status without setting completedAt for non-COMPLETED transitions', async () => {
      prisma.task.findFirst.mockResolvedValue(sampleTask as never);
      prisma.task.update.mockResolvedValue({
        ...sampleTask,
        status: 'IN_PROGRESS',
      } as never);

      await service.updateStatus(
        sampleTask.id,
        { status: 'IN_PROGRESS' },
        SECRETARY_USER,
      );

      const arg = prisma.task.update.mock.calls[0][0];
      expect(arg.data).toMatchObject({ status: 'IN_PROGRESS' });
      expect((arg.data as any).completedAt).toBeUndefined();
    });

    it('stamps completedAt = now when transitioning to COMPLETED', async () => {
      prisma.task.findFirst.mockResolvedValue(sampleTask as never);
      prisma.task.update.mockResolvedValue({
        ...sampleTask,
        status: 'COMPLETED',
        completedAt: new Date(),
      } as never);

      await service.updateStatus(
        sampleTask.id,
        { status: 'COMPLETED' },
        SECRETARY_USER,
      );

      const arg = prisma.task.update.mock.calls[0][0];
      expect(arg.data).toMatchObject({ status: 'COMPLETED' });
      expect((arg.data as any).completedAt).toBeInstanceOf(Date);
    });

    it('SYSTEM_ADMIN can transition any task regardless of membership', async () => {
      prisma.task.findFirst.mockResolvedValue(sampleTask as never);
      prisma.task.update.mockResolvedValue({
        ...sampleTask,
        status: 'CANCELLED',
      } as never);

      await expect(
        service.updateStatus(sampleTask.id, { status: 'CANCELLED' }, ADMIN_USER),
      ).resolves.toBeDefined();
    });
  });
});
