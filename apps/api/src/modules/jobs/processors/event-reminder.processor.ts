import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { addDays, addWeeks, addMonths } from 'date-fns';
import { PrismaService, RecurrenceType } from '@ticketbot/database';
import { BotService } from 'bot';
import { EVENT_REMINDERS_QUEUE } from '../jobs.constants';
import {
  EventReminderJobData,
  EventReminderScheduler,
} from '../event-reminder.scheduler';

const TR_DATE = new Intl.DateTimeFormat('tr-TR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

const EVENT_TYPE_LABELS: Record<string, string> = {
  CONFERENCE: 'Konferans',
  TALK: 'Sohbet',
  SEMINAR: 'Seminer',
  IFTAR: 'İftar Programı',
  KANDIL: 'Kandil Programı',
  MEETING: 'Toplantı',
  CUSTOM: 'Etkinlik',
};

@Processor(EVENT_REMINDERS_QUEUE)
export class EventReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(EventReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bot: BotService,
    private readonly scheduler: EventReminderScheduler,
  ) {
    super();
  }

  async process(job: Job<EventReminderJobData>): Promise<void> {
    const { eventId } = job.data;

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, deletedAt: null },
      include: {
        association: { select: { name: true, shortName: true } },
        assignments: {
          include: {
            membership: {
              include: { user: { select: { id: true, fullName: true } } },
            },
            roleDefinition: { select: { name: true } },
          },
        },
      },
    });

    if (!event) {
      this.logger.debug(`Event ${eventId} not found or deleted; skipping`);
      return;
    }

    if (event.notificationSent) {
      this.logger.debug(`Event ${eventId} already notified; skipping`);
      return;
    }

    const dernek = event.association.shortName ?? event.association.name;
    const typeLabel = EVENT_TYPE_LABELS[event.type] ?? 'Etkinlik';
    const dateLabel = TR_DATE.format(event.startsAt);

    let sentCount = 0;
    for (const assignment of event.assignments) {
      const role =
        assignment.roleDefinition?.name ?? assignment.customRole ?? '—';
      const text = formatEventMessage({
        dernek,
        typeLabel,
        title: event.title,
        dateLabel,
        location: event.location,
        role,
        notes: assignment.notes,
      });

      const ok = await this.bot.sendToUser(
        assignment.membership.user.id,
        text,
        { parseMode: 'HTML' },
      );

      if (ok) {
        sentCount += 1;
        await this.prisma.eventAssignment.update({
          where: { id: assignment.id },
          data: { notificationSent: true, notifiedAt: new Date() },
        });
      }
    }

    this.logger.log(
      `Event ${eventId}: notified ${sentCount}/${event.assignments.length} assignees`,
    );

    await this.prisma.event.update({
      where: { id: eventId },
      data: { notificationSent: true },
    });

    if (event.recurrenceType !== RecurrenceType.NONE) {
      const next = nextOccurrence(
        event.startsAt,
        event.recurrenceType,
        event.recurrenceInterval,
      );
      if (
        next &&
        (!event.recurrenceEndsAt ||
          next.getTime() <= event.recurrenceEndsAt.getTime())
      ) {
        const offsetMs = event.notifyAt.getTime() - event.startsAt.getTime();
        const nextNotifyAt = new Date(next.getTime() + offsetMs);
        const endsOffsetMs = event.endsAt
          ? event.endsAt.getTime() - event.startsAt.getTime()
          : null;
        const nextEndsAt = endsOffsetMs
          ? new Date(next.getTime() + endsOffsetMs)
          : null;

        await this.prisma.event.update({
          where: { id: eventId },
          data: {
            startsAt: next,
            endsAt: nextEndsAt,
            notifyAt: nextNotifyAt,
            notificationSent: false,
          },
        });

        await this.prisma.eventAssignment.updateMany({
          where: { eventId },
          data: { notificationSent: false, notifiedAt: null },
        });

        await this.scheduler.scheduleNextOccurrence(eventId, nextNotifyAt);
      }
    }
  }
}

function nextOccurrence(
  current: Date,
  type: RecurrenceType,
  interval: number,
): Date | null {
  switch (type) {
    case RecurrenceType.DAILY:
      return addDays(current, interval);
    case RecurrenceType.WEEKLY:
      return addWeeks(current, interval);
    case RecurrenceType.MONTHLY:
      return addMonths(current, interval);
    default:
      return null;
  }
}

interface MessageInput {
  dernek: string;
  typeLabel: string;
  title: string;
  dateLabel: string;
  location: string | null;
  role: string;
  notes: string | null;
}

function formatEventMessage(m: MessageInput): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const lines: string[] = [];
  lines.push(`📅 <b>${escape(m.typeLabel)} hatırlatması</b>`);
  lines.push('');
  lines.push(`<b>${escape(m.title)}</b>`);
  lines.push(`🕐 ${escape(m.dateLabel)}`);
  if (m.location) lines.push(`📍 ${escape(m.location)}`);
  lines.push('');
  lines.push(`Görevin: <b>${escape(m.role)}</b>`);
  if (m.notes) {
    lines.push('');
    lines.push(`📝 ${escape(m.notes)}`);
  }
  lines.push('');
  lines.push(`<i>${escape(m.dernek)}</i>`);
  return lines.join('\n');
}
