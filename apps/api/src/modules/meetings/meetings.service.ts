import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, UserRole, PermissionAction } from '@ticketbot/database';
import {
  CreateMeetingNoteInput,
  ListMeetingNotesQuery,
  UpdateMeetingNoteInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { AiService } from '@ticketbot/ai';
import { parseTurkishDateText } from './turkish-date-parser';
import { PermissionService } from '../permissions/permission.service';

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
    private readonly permissionService: PermissionService,
  ) {}

  private async assertMeetingAccess(
    user: AuthenticatedUser,
    associationId: string,
  ) {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return;

    const hasRole = user.memberships.some(
      (m) =>
        m.isActive &&
        m.associationId === associationId &&
        (m.role === UserRole.ASSOCIATION_MANAGER ||
          m.role === UserRole.ASSOCIATION_SECRETARY),
    );
    if (hasRole) return;

    const hasPermission = await this.permissionService.hasPermission(
      user.id,
      associationId,
      PermissionAction.USE_MEETING_COMMANDS,
    );
    if (hasPermission) return;

    throw new ForbiddenException(
      'Toplantı işlemleri için yetkiniz yok',
    );
  }

  private assertManagerAccess(
    user: AuthenticatedUser,
    associationId: string,
  ) {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return;

    const hasRole = user.memberships.some(
      (m) =>
        m.isActive &&
        m.associationId === associationId &&
        m.role === UserRole.ASSOCIATION_MANAGER,
    );
    if (!hasRole) {
      throw new ForbiddenException(
        'Bu işlem için sadece dernek başkanı yetkilidir',
      );
    }
  }

  async analyzeContent(associationId: string, content: string) {
    const members = await this.prisma.associationMembership.findMany({
      where: { associationId, isActive: true, deletedAt: null },
      include: {
        user: { select: { id: true, fullName: true } },
        titleAssignments: {
          include: { title: { select: { name: true, description: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    const ROLE_LABEL: Record<string, string> = {
      ASSOCIATION_MANAGER: 'MANAGER (Başkan)',
      ASSOCIATION_SECRETARY: 'SECRETARY (Sekreter)',
      ASSOCIATION_MEMBER: 'MEMBER (Üye)',
      SYSTEM_ADMIN: 'MANAGER (Başkan)',
    };

    const formatTitle = (ta: {
      title?: { name: string; description: string | null } | null;
      customTitle?: string | null;
    }): string => {
      if (ta.customTitle) return ta.customTitle;
      if (ta.title) {
        return ta.title.description
          ? `${ta.title.name} — ${ta.title.description}`
          : ta.title.name;
      }
      return 'Atanmamış';
    };

    const membersContext = members
      .map((m) => {
        const roleLabel = ROLE_LABEL[m.role] ?? m.role;
        const primary = m.titleAssignments.find((t) => t.isPrimary);
        const secondaries = m.titleAssignments.filter((t) => !t.isPrimary);

        const primaryPart = primary ? formatTitle(primary) : 'Atanmamış';
        const secondaryPart =
          secondaries.length > 0
            ? `\n  📌 İKİNCİL ÜNVANLAR:\n${secondaries.map((s) => `    - ${formatTitle(s)}`).join('\n')}`
            : '';

        return `- User ID: ${m.user.id}\n  İsim: ${m.user.fullName}\n  Sistem Rolü: ${roleLabel}\n  🎯 BİRİNCİL ÜNVAN: ${primaryPart}${secondaryPart}`;
      })
      .join('\n');

    try {
      const result = await this.aiService.extractActionItems(content, membersContext);

      const memberMap = new Map(
        members.map((m) => [m.user.id, { fullName: m.user.fullName, title: m.titleAssignments.find((t) => t.isPrimary)?.title?.name ?? null }]),
      );

      const now = new Date();

      return {
        actionItems: result.actionItems.map((item) => {
          const parsedDate = item.dueDateText
            ? parseTurkishDateText(item.dueDateText, now)
            : null;
          return {
            title: item.title,
            description: item.description,
            assignedToUserId: item.assignedToUserId,
            assignedToUserName: item.assignedToUserId
              ? (memberMap.get(item.assignedToUserId)?.fullName ?? null)
              : null,
            dueDate: parsedDate ? parsedDate.toISOString() : null,
          };
        }),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI extraction failed: ${message}`, err instanceof Error ? err.stack : undefined);
      throw new InternalServerErrorException(`AI hatası: ${message}`);
    }
  }

  async summarizeMeeting(associationId: string, content: string) {
    try {
      return await this.aiService.summarizeMeeting(content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI summarization failed: ${message}`, err instanceof Error ? err.stack : undefined);
      throw new InternalServerErrorException(`AI hatası: ${message}`);
    }
  }

  async suggestAgenda(associationId: string, content: string) {
    const pendingTasks = await this.buildPendingTasksContext(associationId);

    try {
      return await this.aiService.suggestAgenda(content, pendingTasks ?? undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`AI agenda suggestion failed: ${message}`, err instanceof Error ? err.stack : undefined);
      throw new InternalServerErrorException(`AI hatası: ${message}`);
    }
  }

  private async buildPendingTasksContext(associationId: string): Promise<string | null> {
    const tasks = await this.prisma.task.findMany({
      where: {
        associationId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        deletedAt: null,
      },
      orderBy: { dueDate: 'asc' },
      take: 20,
      select: {
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        assignedTo: { select: { fullName: true } },
      },
    });

    if (tasks.length === 0) return null;

    return tasks
      .map((t) => {
        const due = t.dueDate ? ` (Bitiş: ${t.dueDate.toISOString().slice(0, 10)})` : '';
        const prio = `Öncelik: ${t.priority}`;
        const assignee = t.assignedTo ? ` Atanan: ${t.assignedTo.fullName}` : '';
        return `- ${t.title}${due} — ${prio}${assignee}`;
      })
      .join('\n');
  }

  async create(
    associationId: string,
    input: CreateMeetingNoteInput,
    user: AuthenticatedUser,
  ) {
    await this.assertMeetingAccess(user, associationId);

    const uniqueAttendees = Array.from(new Set(input.attendeeUserIds));
    await this.ensureAllAreMembers(associationId, uniqueAttendees);

    let tasksToCreate: {
      associationId: string;
      title: string;
      description: string | null;
      assignedToUserId: string;
      assignedById: string;
      sourceMeetingNoteId: string;
      dueDate: Date | null;
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
          dueDate: t.dueDate ? new Date(t.dueDate) : null,
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

  async update(
    associationId: string,
    meetingId: string,
    input: UpdateMeetingNoteInput,
    user: AuthenticatedUser,
  ) {
    await this.assertMeetingAccess(user, associationId);

    const meeting = await this.prisma.meetingNote.findFirst({
      where: { id: meetingId, associationId, deletedAt: null },
    });
    if (!meeting) throw new NotFoundException('Toplantı bulunamadı');

    if (input.attendeeUserIds) {
      await this.ensureAllAreMembers(associationId, Array.from(new Set(input.attendeeUserIds)));
    }

    return this.prisma.$transaction(async (tx) => {
      if (input.attendeeUserIds !== undefined) {
        await tx.meetingAttendee.deleteMany({ where: { meetingNoteId: meetingId } });
        await tx.meetingAttendee.createMany({
          data: Array.from(new Set(input.attendeeUserIds)).map((userId) => ({
            meetingNoteId: meetingId,
            userId,
          })),
        });
      }

      return tx.meetingNote.update({
        where: { id: meetingId },
        data: {
          ...(input.title !== undefined && { title: input.title }),
          ...(input.content !== undefined && { content: input.content }),
          ...(input.meetingDate !== undefined && { meetingDate: new Date(input.meetingDate) }),
        },
        include: ATTENDEE_INCLUDE,
      });
    });
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
