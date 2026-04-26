import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, UserRole } from '@ticketbot/database';
import {
  CreateMeetingNoteInput,
  ListMeetingNotesQuery,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { AiService } from '@ticketbot/ai';

const ATTENDEE_INCLUDE = {
  attendees: {
    include: {
      user: { select: { id: true, fullName: true, email: true } },
    },
  },
};

@Injectable()
export class MeetingsService {
  private readonly logger = new Logger(MeetingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  async analyzeContent(associationId: string, content: string) {
    const members = await this.prisma.associationMembership.findMany({
      where: { associationId, isActive: true, deletedAt: null },
      include: {
        user: { select: { id: true, fullName: true } },
        title: { select: { name: true } },
      },
    });

    const membersContext = members
      .map(
        (m) =>
          `- User ID: ${m.user.id}, Name: ${m.user.fullName}, Title: ${m.title?.name ?? 'Unassigned'}`,
      )
      .join('\n');

    try {
      const result = await this.aiService.extractActionItems(content, membersContext);

      const memberMap = new Map(
        members.map((m) => [m.user.id, { fullName: m.user.fullName, title: m.title?.name ?? null }]),
      );

      return {
        actionItems: result.actionItems.map((item) => ({
          ...item,
          assignedToUserName: item.assignedToUserId
            ? (memberMap.get(item.assignedToUserId)?.fullName ?? null)
            : null,
        })),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI extraction failed: ${message}`, err instanceof Error ? err.stack : undefined);
      throw new InternalServerErrorException(`AI hatası: ${message}`);
    }
  }

  async create(
    associationId: string,
    input: CreateMeetingNoteInput,
    user: AuthenticatedUser,
  ) {
    const uniqueAttendees = Array.from(new Set(input.attendeeUserIds));
    await this.ensureAllAreMembers(associationId, uniqueAttendees);

    let tasksToCreate: {
      associationId: string;
      title: string;
      description: string | null;
      assignedToUserId: string;
      assignedById: string;
      sourceMeetingNoteId: string;
    }[] = [];

    if (input.preApprovedTasks && input.preApprovedTasks.length > 0) {
      const members = await this.prisma.associationMembership.findMany({
        where: { associationId, isActive: true, deletedAt: null },
        select: { userId: true },
      });
      const validMemberIds = new Set(members.map((m) => m.userId));

      tasksToCreate = input.preApprovedTasks.map((t) => {
        const assigneeId =
          t.assignedToUserId && validMemberIds.has(t.assignedToUserId)
            ? t.assignedToUserId
            : user.id;
        return {
          associationId,
          title: t.title,
          description: t.description ?? null,
          assignedToUserId: assigneeId,
          assignedById: user.id,
          sourceMeetingNoteId: '',
        };
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const meeting = await tx.meetingNote.create({
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

      if (tasksToCreate.length > 0) {
        await tx.task.createMany({
          data: tasksToCreate.map((t) => ({
            ...t,
            sourceMeetingNoteId: meeting.id,
          })),
        });
      }

      return meeting;
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
