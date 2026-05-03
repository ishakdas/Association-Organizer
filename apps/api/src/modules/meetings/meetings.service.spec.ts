import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { AiService } from '@ticketbot/ai';
import { MeetingsService } from './meetings.service';

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

const sampleMeeting = {
  id: 'meeting-1',
  associationId: ASSOC,
  title: 'Aylık Yönetim Toplantısı',
  content: 'Konular: bütçe, etkinlik takvimi.',
  meetingDate: new Date('2026-04-25T10:00:00Z'),
  createdById: SECRETARY_USER.id,
  createdAt: new Date('2026-04-24'),
  updatedAt: new Date('2026-04-24'),
  deletedAt: null,
  attendees: [
    {
      id: 'att-1',
      meetingNoteId: 'meeting-1',
      userId: 'mem-1',
      user: { id: 'mem-1', fullName: 'Ali Veli', email: 'ali@dernek.local' },
    },
  ],
};

const validInput = {
  title: 'Aylık Yönetim Toplantısı',
  content: 'Konular: bütçe, etkinlik takvimi.',
  meetingDate: '2026-04-25T10:00:00.000Z',
  attendeeUserIds: ['mem-1', 'mem-2'],
};

const fakeAiService = { extractActionItems: jest.fn().mockResolvedValue({ actionItems: [] }) };

describe('MeetingsService', () => {
  let service: MeetingsService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    prisma.$transaction.mockImplementation(async (input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(prisma);
    });
    prisma.meetingNote.count.mockResolvedValue(0 as never);
    fakeAiService.extractActionItems.mockResolvedValue({ actionItems: [] });

    const moduleRef = await Test.createTestingModule({
      providers: [
        MeetingsService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: fakeAiService },
      ],
    }).compile();
    service = moduleRef.get(MeetingsService);
  });

  describe('create', () => {
    it('rejects with BadRequest when ANY attendee is not an active member', async () => {
      // Only one of two requested users comes back from the membership lookup.
      prisma.associationMembership.findMany.mockResolvedValue([
        { userId: 'mem-1' },
      ] as never);

      await expect(
        service.create(ASSOC, validInput, SECRETARY_USER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prisma.meetingNote.create).not.toHaveBeenCalled();
    });

    it('creates the meeting + attendees in a single transaction (happy path)', async () => {
      prisma.associationMembership.findMany.mockResolvedValue([
        { userId: 'mem-1' },
        { userId: 'mem-2' },
      ] as never);
      prisma.meetingNote.create.mockResolvedValue(sampleMeeting as never);

      const result = await service.create(ASSOC, validInput, SECRETARY_USER);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.meetingNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          associationId: ASSOC,
          title: 'Aylık Yönetim Toplantısı',
          content: 'Konular: bütçe, etkinlik takvimi.',
          createdById: SECRETARY_USER.id,
          attendees: {
            create: [{ userId: 'mem-1' }, { userId: 'mem-2' }],
          },
        }),
        include: expect.any(Object),
      });
      expect(result).toEqual(sampleMeeting);
    });

    it('coerces meetingDate string to Date', async () => {
      prisma.associationMembership.findMany.mockResolvedValue([
        { userId: 'mem-1' },
        { userId: 'mem-2' },
      ] as never);
      prisma.meetingNote.create.mockResolvedValue(sampleMeeting as never);

      await service.create(ASSOC, validInput, SECRETARY_USER);

      const arg = prisma.meetingNote.create.mock.calls[0][0];
      expect((arg.data as any).meetingDate).toBeInstanceOf(Date);
    });

    it('dedupes attendeeUserIds before checking + creating', async () => {
      prisma.associationMembership.findMany.mockResolvedValue([
        { userId: 'mem-1' },
      ] as never);
      prisma.meetingNote.create.mockResolvedValue(sampleMeeting as never);

      await service.create(
        ASSOC,
        { ...validInput, attendeeUserIds: ['mem-1', 'mem-1', 'mem-1'] },
        SECRETARY_USER,
      );

      const arg = prisma.meetingNote.create.mock.calls[0][0];
      expect((arg.data as any).attendees.create).toEqual([{ userId: 'mem-1' }]);
    });
  });

  describe('list', () => {
    it('returns dernek-scoped meetings ordered by meetingDate desc', async () => {
      prisma.meetingNote.findMany.mockResolvedValue([sampleMeeting] as never);
      prisma.meetingNote.count.mockResolvedValue(1 as never);

      const result = await service.list(ASSOC, { page: 1, pageSize: 20 });

      const arg = prisma.meetingNote.findMany.mock.calls[0][0];
      expect((arg as any).where).toEqual({ associationId: ASSOC, deletedAt: null });
      expect((arg as any).orderBy).toEqual({ meetingDate: 'desc' });
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('throws NotFound when meeting does not exist', async () => {
      prisma.meetingNote.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing', ADMIN_USER)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('forbids users without an active membership in the meeting association', async () => {
      prisma.meetingNote.findFirst.mockResolvedValue({
        ...sampleMeeting,
        associationId: 'other-assoc',
      } as never);

      await expect(
        service.findOne(sampleMeeting.id, SECRETARY_USER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns meeting with attendees + user details when authorized', async () => {
      prisma.meetingNote.findFirst.mockResolvedValue(sampleMeeting as never);

      const result = await service.findOne(sampleMeeting.id, SECRETARY_USER);

      expect(result).toEqual(sampleMeeting);
      const arg = prisma.meetingNote.findFirst.mock.calls[0][0];
      expect((arg as any).include).toMatchObject({
        attendees: expect.objectContaining({
          include: { user: expect.any(Object) },
        }),
      });
    });

    it('SYSTEM_ADMIN can read any meeting regardless of membership', async () => {
      prisma.meetingNote.findFirst.mockResolvedValue({
        ...sampleMeeting,
        associationId: 'other-assoc',
      } as never);

      await expect(
        service.findOne(sampleMeeting.id, ADMIN_USER),
      ).resolves.toBeDefined();
    });
  });

  describe('analyzeContent — member context', () => {
    it('passes role label, title description and customTitle to AI service', async () => {
      prisma.associationMembership.findMany.mockResolvedValue([
        {
          user: { id: 'u1', fullName: 'Ali Veli' },
          role: 'ASSOCIATION_MANAGER',
          customTitle: null,
          title: { name: 'Teşkilat Başkanı', description: 'Üye kazanımı, koordinasyon' },
        },
        {
          user: { id: 'u2', fullName: 'Ayşe Demir' },
          role: 'ASSOCIATION_MEMBER',
          customTitle: 'Bölge Temsilcisi',
          title: null,
        },
      ] as never);

      await service.analyzeContent(ASSOC, 'Toplantı notları');

      const [, membersContext] = fakeAiService.extractActionItems.mock.calls[0];
      expect(membersContext).toContain('MANAGER (Başkan)');
      expect(membersContext).toContain('Üye kazanımı, koordinasyon');
      expect(membersContext).toContain('Bölge Temsilcisi');
      expect(membersContext).toContain('MEMBER (Üye)');
    });

    it('returns actionItems with assignedToUserName resolved from member map', async () => {
      prisma.associationMembership.findMany.mockResolvedValue([
        {
          user: { id: 'u1', fullName: 'Ali Veli' },
          role: 'ASSOCIATION_MANAGER',
          customTitle: null,
          title: null,
        },
      ] as never);

      fakeAiService.extractActionItems.mockResolvedValueOnce({
        actionItems: [{ title: 'Toplantı düzenle', description: null, assignedToUserId: 'u1' }],
      });

      const result = await service.analyzeContent(ASSOC, 'Notlar');

      expect(result.actionItems[0].assignedToUserName).toBe('Ali Veli');
    });
  });
});
