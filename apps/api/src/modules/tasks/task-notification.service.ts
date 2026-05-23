import { Injectable, Logger } from '@nestjs/common';
import { BotService, escapeMarkdown } from 'bot';
import { PrismaService, UserRole } from '@ticketbot/database';

const TR_FORMATTER = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Istanbul',
});

@Injectable()
export class TaskNotificationService {
  private readonly logger = new Logger(TaskNotificationService.name);

  constructor(
    private readonly botService: BotService,
    private readonly prisma: PrismaService,
  ) {}

  async notifyTaskCompleted(
    associationId: string,
    taskId: string,
    taskTitle: string,
    assigneeName: string,
    assignedDate: Date,
    completedAt: Date,
  ): Promise<void> {
    const managers = await this.getManagersWithTelegram(associationId);
    if (managers.length === 0) return;

    const assignedStr = TR_FORMATTER.format(assignedDate);
    const completedStr = TR_FORMATTER.format(completedAt);
    const title = escapeMarkdown(taskTitle);
    const name = escapeMarkdown(assigneeName);

    const message = `📋 *Görev Tamamlandı*\n\n` +
      `👤 *${name}* "${title}" görevini ${assignedStr} tarihinde aldı ve bugün (${completedStr}) tamamladı.\n\n` +
      `Bilgilerinize sunarım başkanım.`;

    await this.sendToAll(managers, message);
  }

  async notifyTaskCancelled(
    associationId: string,
    taskId: string,
    taskTitle: string,
    assigneeName: string,
    cancelledBy: string,
  ): Promise<void> {
    const managers = await this.getManagersWithTelegram(associationId);
    if (managers.length === 0) return;

    const title = escapeMarkdown(taskTitle);
    const name = escapeMarkdown(assigneeName);
    const by = escapeMarkdown(cancelledBy);

    const message = `❌ *Görev İptal Edildi*\n\n` +
      `👤 *${name}* "${title}" görevini iptal etti.\n` +
      `İptal eden: *${by}*`;

    await this.sendToAll(managers, message);
  }

  async notifyOverdueTasks(
    associationId: string,
    overdueTasks: Array<{
      taskId: string;
      title: string;
      assigneeName: string;
      dueDate: Date;
    }>,
  ): Promise<void> {
    const managers = await this.getManagersWithTelegram(associationId);
    if (managers.length === 0) return;

    let message = `⚠️ *Süresi Geçen Görevler*\n\n`;

    for (const t of overdueTasks) {
      const title = escapeMarkdown(t.title);
      const name = escapeMarkdown(t.assigneeName);
      const dueStr = TR_FORMATTER.format(t.dueDate);
      message += `• "${title}" — ${name} (bitiş: ${dueStr})\n`;
    }

    message += `\nToplam: *${overdueTasks.length} görev* süresini geçti.`;

    await this.sendToAll(managers, message);
  }

  private async getManagersWithTelegram(associationId: string): Promise<Array<{ userId: string; fullName: string }>> {
    const memberships = await this.prisma.associationMembership.findMany({
      where: {
        associationId,
        role: { in: [UserRole.ASSOCIATION_MANAGER, UserRole.SYSTEM_ADMIN] },
        isActive: true,
        deletedAt: null,
      },
      include: {
        user: {
          select: { id: true, fullName: true },
          include: { telegramAccount: true },
        },
      },
    });

    return memberships
      .filter((m) => m.user.telegramAccount !== null)
      .map((m) => ({ userId: m.user.id, fullName: m.user.fullName }));
  }

  private async sendToAll(
    users: Array<{ userId: string; fullName: string }>,
    message: string,
  ): Promise<void> {
    for (const user of users) {
      try {
        await this.botService.sendToUser(user.userId, message, { parseMode: 'Markdown' });
      } catch (err) {
        this.logger.warn(`Bildirim gönderilemedi (${user.fullName}): ${(err as Error).message}`);
      }
    }
  }
}
