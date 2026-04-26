import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, UserRole } from '@ticketbot/database';
import {
  CreateMeetingNoteInput,
  ListMeetingNotesQuery,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';

const ATTENDEE_INCLUDE = {
  attendees: {
    include: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  },
};

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    associationId: string,
    input: CreateMeetingNoteInput,
    user: AuthenticatedUser,
  ) {
    const uniqueAttendees = Array.from(new Set(input.attendeeUserIds));
    await this.ensureAllAreMembers(associationId, uniqueAttendees);

    return this.prisma.$transaction(async (tx) => {
      return tx.meetingNote.create({
        data: {
          associationId,
          title: input.title,
          content: input.content,
          meetingDate: new Date(input.meetingDate),
          createdById: user.id,
          attendees: {
            create: uniqueAttendees.map((userId) => ({ userId })),
          },
        },
        include: ATTENDEE_INCLUDE,
      });
    });
  }

  async list(associationId: string, query: ListMeetingNotesQuery) {
    const where = { associationId, deletedAt: null };
    const { page, pageSize } = query;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.meetingNote.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { meetingDate: 'desc' },
        include: ATTENDEE_INCLUDE,
      }),
      this.prisma.meetingNote.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async findOne(meetingId: string, user: AuthenticatedUser) {
    const meeting = await this.prisma.meetingNote.findFirst({
      where: { id: meetingId, deletedAt: null },
      include: ATTENDEE_INCLUDE,
    });
    if (!meeting) throw new NotFoundException('Toplantı bulunamadı');

    if (
      user.systemRole !== UserRole.SYSTEM_ADMIN &&
      !user.memberships.some(
        (m) => m.isActive && m.associationId === meeting.associationId,
      )
    ) {
      throw new ForbiddenException('Bu toplantı için yetkiniz yok');
    }

    return meeting;
  }

  private async ensureAllAreMembers(
    associationId: string,
    attendeeUserIds: string[],
  ) {
    const found = await this.prisma.associationMembership.findMany({
      where: {
        associationId,
        userId: { in: attendeeUserIds },
        isActive: true,
        deletedAt: null,
      },
      select: { userId: true },
    });
    const foundIds = new Set(found.map((m) => m.userId));
    const missing = attendeeUserIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Bazı katılımcılar bu derneğe üye değil: ${missing.join(', ')}`,
      );
    }
  }
}
