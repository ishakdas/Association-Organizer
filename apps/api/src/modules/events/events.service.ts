import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, Prisma } from '@ticketbot/database';
import { AiService } from '@ticketbot/ai';
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsQuery,
  EventAssignmentInput,
  UpdateEventAssignmentInput,
  SuggestIslamicEventsInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { EventReminderScheduler } from '../jobs/event-reminder.scheduler';
import { IslamicCalendarService } from '../islamic-calendar/islamic-calendar.service';

const ASSIGNMENT_INCLUDE = {
  membership: {
    include: {
      user: { select: { id: true, fullName: true, phone: true } },
    },
  },
  roleDefinition: { select: { id: true, name: true } },
} as const;

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: EventReminderScheduler,
    private readonly ai: AiService,
    private readonly islamicCalendar: IslamicCalendarService,
  ) {}

  async create(
    associationId: string,
    input: CreateEventInput,
    user: AuthenticatedUser,
  ) {
    await this.validateAssignments(associationId, input.assignments);

    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.event.create({
        data: {
          associationId,
          title: input.title,
          description: input.description ?? null,
          type: input.type,
          location: input.location ?? null,
          startsAt: new Date(input.startsAt),
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          notifyAt: new Date(input.notifyAt),
          recurrenceType: input.recurrenceType,
          recurrenceInterval: input.recurrenceInterval,
          recurrenceEndsAt: input.recurrenceEndsAt
            ? new Date(input.recurrenceEndsAt)
            : null,
          createdById: user.id,
        },
      });

      if (input.assignments.length > 0) {
        await tx.eventAssignment.createMany({
          data: input.assignments.map((a) => ({
            eventId: created.id,
            membershipId: a.membershipId,
            roleDefinitionId: a.roleDefinitionId ?? null,
            customRole: a.customRole ?? null,
            notes: a.notes ?? null,
          })),
        });
      }

      return created;
    });

    await this.scheduler.scheduleEvent({
      id: event.id,
      notifyAt: event.notifyAt,
    });

    return this.getOrThrow(associationId, event.id);
  }

  async list(associationId: string, query: ListEventsQuery) {
    const where: Prisma.EventWhereInput = {
      associationId,
      deletedAt: null,
    };
    if (query.type) where.type = query.type;
    if (query.fromDate || query.toDate) {
      where.startsAt = {};
      if (query.fromDate) where.startsAt.gte = new Date(query.fromDate);
      if (query.toDate) where.startsAt.lte = new Date(query.toDate);
    }

    const { page, pageSize } = query;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startsAt: 'asc' },
        include: { _count: { select: { assignments: true } } },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: rows.map((e) => ({
        id: e.id,
        associationId: e.associationId,
        title: e.title,
        type: e.type,
        location: e.location,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt ? e.endsAt.toISOString() : null,
        notifyAt: e.notifyAt.toISOString(),
        recurrenceType: e.recurrenceType,
        notificationSent: e.notificationSent,
        assignmentCount: e._count.assignments,
        createdAt: e.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async get(associationId: string, eventId: string) {
    return this.getOrThrow(associationId, eventId);
  }

  async update(
    associationId: string,
    eventId: string,
    input: UpdateEventInput,
  ) {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, associationId, deletedAt: null },
      select: { id: true, notifyAt: true },
    });
    if (!existing) throw new NotFoundException('Etkinlik bulunamadı');

    const data: Prisma.EventUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined)
      data.description = input.description ?? null;
    if (input.type !== undefined) data.type = input.type;
    if (input.location !== undefined) data.location = input.location ?? null;
    if (input.startsAt !== undefined) data.startsAt = new Date(input.startsAt);
    if (input.endsAt !== undefined)
      data.endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (input.notifyAt !== undefined) data.notifyAt = new Date(input.notifyAt);
    if (input.recurrenceType !== undefined)
      data.recurrenceType = input.recurrenceType;
    if (input.recurrenceInterval !== undefined)
      data.recurrenceInterval = input.recurrenceInterval;
    if (input.recurrenceEndsAt !== undefined)
      data.recurrenceEndsAt = input.recurrenceEndsAt
        ? new Date(input.recurrenceEndsAt)
        : null;

    if (input.notifyAt !== undefined) {
      data.notificationSent = false;
    }

    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data,
      select: { id: true, notifyAt: true },
    });

    if (input.notifyAt !== undefined) {
      await this.scheduler.rescheduleEvent({
        id: updated.id,
        notifyAt: updated.notifyAt,
      });
    }

    return this.getOrThrow(associationId, eventId);
  }

  async softDelete(associationId: string, eventId: string) {
    const existing = await this.prisma.event.findFirst({
      where: { id: eventId, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Etkinlik bulunamadı');

    await this.prisma.event.update({
      where: { id: eventId },
      data: { deletedAt: new Date() },
    });

    await this.scheduler.cancelEvent(eventId);
    return { ok: true };
  }

  async addAssignment(
    associationId: string,
    eventId: string,
    input: EventAssignmentInput,
  ) {
    await this.ensureEventExists(associationId, eventId);
    await this.validateAssignments(associationId, [input]);

    const created = await this.prisma.eventAssignment.create({
      data: {
        eventId,
        membershipId: input.membershipId,
        roleDefinitionId: input.roleDefinitionId ?? null,
        customRole: input.customRole ?? null,
        notes: input.notes ?? null,
      },
      include: ASSIGNMENT_INCLUDE,
    });

    return this.toAssignmentDto(created);
  }

  async updateAssignment(
    associationId: string,
    eventId: string,
    assignmentId: string,
    input: UpdateEventAssignmentInput,
  ) {
    const assignment = await this.prisma.eventAssignment.findFirst({
      where: {
        id: assignmentId,
        eventId,
        event: { associationId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('Sorumluluk bulunamadı');

    if (input.roleDefinitionId) {
      await this.ensureRoleDefinitionExists(
        associationId,
        input.roleDefinitionId,
      );
    }

    const data: Prisma.EventAssignmentUpdateInput = {};
    if (input.notes !== undefined) data.notes = input.notes ?? null;
    if (input.customRole !== undefined) {
      data.customRole = input.customRole ?? null;
      if (input.customRole) {
        data.roleDefinition = { disconnect: true };
      }
    }
    if (input.roleDefinitionId !== undefined) {
      if (input.roleDefinitionId) {
        data.roleDefinition = { connect: { id: input.roleDefinitionId } };
        data.customRole = null;
      } else {
        data.roleDefinition = { disconnect: true };
      }
    }

    const updated = await this.prisma.eventAssignment.update({
      where: { id: assignmentId },
      data,
      include: ASSIGNMENT_INCLUDE,
    });

    return this.toAssignmentDto(updated);
  }

  async removeAssignment(
    associationId: string,
    eventId: string,
    assignmentId: string,
  ) {
    const assignment = await this.prisma.eventAssignment.findFirst({
      where: {
        id: assignmentId,
        eventId,
        event: { associationId, deletedAt: null },
      },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('Sorumluluk bulunamadı');

    await this.prisma.eventAssignment.delete({ where: { id: assignmentId } });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------

  private async getOrThrow(associationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, associationId, deletedAt: null },
      include: {
        assignments: {
          include: ASSIGNMENT_INCLUDE,
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!event) throw new NotFoundException('Etkinlik bulunamadı');

    return {
      id: event.id,
      associationId: event.associationId,
      title: event.title,
      description: event.description,
      type: event.type,
      location: event.location,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt ? event.endsAt.toISOString() : null,
      notifyAt: event.notifyAt.toISOString(),
      recurrenceType: event.recurrenceType,
      recurrenceInterval: event.recurrenceInterval,
      recurrenceEndsAt: event.recurrenceEndsAt
        ? event.recurrenceEndsAt.toISOString()
        : null,
      notificationSent: event.notificationSent,
      createdById: event.createdById,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
      assignments: event.assignments.map((a) => this.toAssignmentDto(a)),
    };
  }

  private async ensureEventExists(associationId: string, eventId: string) {
    const exists = await this.prisma.event.findFirst({
      where: { id: eventId, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Etkinlik bulunamadı');
  }

  private async validateAssignments(
    associationId: string,
    assignments: EventAssignmentInput[],
  ) {
    if (assignments.length === 0) return;

    const membershipIds = [...new Set(assignments.map((a) => a.membershipId))];
    const memberships = await this.prisma.associationMembership.findMany({
      where: {
        id: { in: membershipIds },
        associationId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (memberships.length !== membershipIds.length) {
      throw new BadRequestException(
        'Bir veya daha fazla üye bu derneğe ait değil',
      );
    }

    const roleIds = [
      ...new Set(
        assignments
          .map((a) => a.roleDefinitionId)
          .filter((v): v is string => Boolean(v)),
      ),
    ];
    if (roleIds.length > 0) {
      const roles = await this.prisma.eventRoleDefinition.findMany({
        where: {
          id: { in: roleIds },
          associationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (roles.length !== roleIds.length) {
        throw new BadRequestException(
          'Bir veya daha fazla rol bu derneğe ait değil',
        );
      }
    }

    const seen = new Set<string>();
    for (const a of assignments) {
      const key = `${a.membershipId}:${a.roleDefinitionId ?? a.customRole}`;
      if (seen.has(key)) {
        throw new BadRequestException(
          'Aynı kişiye aynı rol birden fazla atanamaz',
        );
      }
      seen.add(key);
    }
  }

  private async ensureRoleDefinitionExists(
    associationId: string,
    roleDefinitionId: string,
  ) {
    const exists = await this.prisma.eventRoleDefinition.findFirst({
      where: {
        id: roleDefinitionId,
        associationId,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!exists) {
      throw new BadRequestException('Rol bu derneğe ait değil');
    }
  }

  private toAssignmentDto(row: {
    id: string;
    eventId: string;
    membershipId: string;
    roleDefinitionId: string | null;
    customRole: string | null;
    notes: string | null;
    notificationSent: boolean;
    notifiedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    membership: { user: { id: string; fullName: string; phone: string | null } };
    roleDefinition: { id: string; name: string } | null;
  }) {
    return {
      id: row.id,
      eventId: row.eventId,
      membershipId: row.membershipId,
      member: {
        id: row.membership.user.id,
        fullName: row.membership.user.fullName,
        phone: row.membership.user.phone,
      },
      roleDefinitionId: row.roleDefinitionId,
      roleDefinition: row.roleDefinition,
      customRole: row.customRole,
      notes: row.notes,
      notificationSent: row.notificationSent,
      notifiedAt: row.notifiedAt ? row.notifiedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Islamic event suggestions
  // ---------------------------------------------------------------------------

  async suggestIslamicEvents(
    associationId: string,
    input: SuggestIslamicEventsInput,
    user: AuthenticatedUser,
    creative = false,
  ) {
    const association = await this.prisma.association.findFirst({
      where: { id: associationId, deletedAt: null },
      select: { id: true, city: true, memberCount: true },
    });
    if (!association) throw new NotFoundException('Dernek bulunamadı');

    // Fetch past events for profile + duplication avoidance
    const pastEvents = await this.prisma.event.findMany({
      where: { associationId, deletedAt: null },
      select: { title: true, type: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const pastEventTitles = pastEvents.map((e) => e.title);

    // Build category breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const ev of pastEvents) {
      categoryBreakdown[ev.type] = (categoryBreakdown[ev.type] ?? 0) + 1;
    }

    // Upcoming Islamic holidays — safe fallback if calendar service fails
    let upcomingHolidays: { name: string; date: string; daysUntil: number }[] = [];
    try {
      if (this.islamicCalendar) {
        upcomingHolidays = this.islamicCalendar.getHolidaysForPrompt(5);
      }
    } catch (calendarErr) {
      // Silently ignore calendar errors so AI suggestion still works
      console.warn('Islamic calendar lookup failed:', calendarErr);
    }

    const currentDate = new Date().toISOString().split('T')[0];

    const aiCall = creative
      ? this.ai.suggestIslamicEventsWithChainOfThought(
          input.period,
          input.targetAudience,
          currentDate,
          pastEventTitles,
          {
            memberCount: association.memberCount,
            city: association.city,
            pastCategoryBreakdown: categoryBreakdown,
          },
          upcomingHolidays,
        )
      : this.ai.suggestIslamicEvents(
          input.period,
          input.targetAudience,
          currentDate,
          pastEventTitles,
          {
            memberCount: association.memberCount,
            city: association.city,
            pastCategoryBreakdown: categoryBreakdown,
          },
          upcomingHolidays,
        );

    const result = await aiCall;

    // Persist suggestions for feedback/archive
    try {
      await this.prisma.$transaction(
        result.suggestions.map((s) =>
          this.prisma.aiSuggestion.create({
            data: {
              associationId,
              period: input.period,
              targetAudience: input.targetAudience,
              title: s.title,
              description: s.description,
              category: s.category,
              keyTopics: s.keyTopics,
              resourcesNeeded: s.resourcesNeeded,
              estimatedParticipants: s.estimatedParticipants,
              islamicSession: s.islamicSession ?? undefined,
              metadata: {
                creative,
                temperature: 0.85,
              },
              createdById: user.id,
            },
          }),
        ),
      );
    } catch (persistErr) {
      console.warn('Failed to persist AI suggestions:', persistErr);
      // Non-critical: still return the result to the user
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // External events (Gebze Belediyesi)
  // ---------------------------------------------------------------------------

  async listGebzeExternalEvents(associationId: string) {
    const association = await this.prisma.association.findFirst({
      where: { id: associationId, deletedAt: null },
      select: { district: true },
    });
    if (!association) throw new NotFoundException('Dernek bulunamadı');

    if (association.district?.toLowerCase() !== 'gebze') {
      return { data: [] };
    }

    // Ensure fresh data by fetching and caching
    await this.syncGebzeEvents();

    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);

    const rows = await this.prisma.externalEvent.findMany({
      where: {
        source: 'gebze_belediyesi',
        eventDate: { gte: fromDate },
      },
      orderBy: { eventDate: 'asc' },
      take: 100,
    });

    return {
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        location: r.location,
        eventDate: r.eventDate.toISOString().split('T')[0],
        eventTime: r.eventTime,
        imageUrl: r.imageUrl,
        detailUrl: r.detailUrl,
      })),
    };
  }

  private async syncGebzeEvents() {
    const lastSync = await this.prisma.externalEvent.findFirst({
      where: { source: 'gebze_belediyesi' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    if (lastSync && lastSync.updatedAt > sixHoursAgo) {
      return;
    }

    try {
      const res = await fetch('https://www.gebze.bel.tr/json/etkinlik.json');
      if (!res.ok) return;

      const raw = (await res.json()) as Array<{
        id: number;
        baslik: string;
        kategori: string;
        konum: string;
        tarih: string;
        saat: string;
        url: string;
        resim: string;
      }>;

      const baseUrl = 'https://www.gebze.bel.tr/';

      for (const item of raw) {
        const externalId = String(item.id);
        const eventDate = new Date(item.tarih);
        if (isNaN(eventDate.getTime())) continue;

        await this.prisma.externalEvent.upsert({
          where: {
            source_externalId: {
              source: 'gebze_belediyesi',
              externalId,
            },
          },
          update: {
            title: item.baslik,
            category: item.kategori,
            location: item.konum,
            eventDate,
            eventTime: item.saat || null,
            detailUrl: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
            imageUrl: item.resim ? `${baseUrl}${item.resim}` : null,
          },
          create: {
            source: 'gebze_belediyesi',
            externalId,
            title: item.baslik,
            category: item.kategori,
            location: item.konum,
            eventDate,
            eventTime: item.saat || null,
            detailUrl: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`,
            imageUrl: item.resim ? `${baseUrl}${item.resim}` : null,
          },
        });
      }
    } catch {
      // Silently fail — cached data will be served
    }
  }

  // ---------------------------------------------------------------------------
  // Saved suggestions
  // ---------------------------------------------------------------------------

  async saveSuggestion(
    userId: string,
    suggestionId: string,
    note?: string,
  ) {
    return this.prisma.savedSuggestion.upsert({
      where: {
        userId_suggestionId: {
          userId,
          suggestionId,
        },
      },
      update: { note: note ?? null },
      create: {
        userId,
        suggestionId,
        note: note ?? null,
      },
    });
  }

  async listSavedSuggestions(userId: string) {
    return this.prisma.savedSuggestion.findMany({
      where: { userId },
      include: {
        suggestion: {
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            targetAudience: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async unsaveSuggestion(userId: string, suggestionId: string) {
    await this.prisma.savedSuggestion.deleteMany({
      where: { userId, suggestionId },
    });
  }

  // ---------------------------------------------------------------------------
  // Suggestion feedback
  // ---------------------------------------------------------------------------

  async addFeedback(
    suggestionId: string,
    rating: number,
    isHelpful?: boolean,
    comment?: string,
  ) {
    return this.prisma.aiSuggestionFeedback.upsert({
      where: { suggestionId },
      update: {
        rating,
        isHelpful: isHelpful ?? null,
        comment: comment ?? null,
      },
      create: {
        suggestionId,
        rating,
        isHelpful: isHelpful ?? null,
        comment: comment ?? null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Event program items
  // ---------------------------------------------------------------------------

  async addProgramToEvent(
    associationId: string,
    eventId: string,
    items: Array<{ startTime: string; duration: string; title: string; description?: string; order?: number }>,
  ) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, associationId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Etkinlik bulunamadı');

    await this.prisma.eventProgramItem.deleteMany({
      where: { eventId },
    });

    await this.prisma.eventProgramItem.createMany({
      data: items.map((item, idx) => ({
        eventId,
        startTime: item.startTime,
        duration: item.duration,
        title: item.title,
        description: item.description ?? null,
        order: item.order ?? idx,
      })),
    });

    return this.prisma.eventProgramItem.findMany({
      where: { eventId },
      orderBy: { order: 'asc' },
    });
  }

  async getEventProgram(associationId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, associationId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Etkinlik bulunamadı');

    return this.prisma.eventProgramItem.findMany({
      where: { eventId },
      orderBy: { order: 'asc' },
    });
  }
}
