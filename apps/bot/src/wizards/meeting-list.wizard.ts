import { Telegraf, Markup } from 'telegraf';
import { PermissionAction, PrismaService, UserRole } from '@ticketbot/database';
import { AiService } from '@ticketbot/ai';

const sessions = new Map<
  number,
  {
    userId: string;
    meetingId?: string;
    associationId?: string;
    canManage?: boolean;
    step: 'detail' | 'aiReview' | 'aiAssign';
    members?: Array<{
      userId: string;
      fullName: string;
      role: string;
      title?: string;
      telegramLinked: boolean;
    }>;
    aiItems?: Array<{
      index: number;
      title: string;
      description: string | null;
      assignedToUserId: string | null;
      dueDate: Date | null;
      removed: boolean;
    }>;
    expiresAt: number;
  }
>();

const SESSION_TTL_MS = 30 * 60 * 1000;

interface MeetingTaskCreateInput {
  title: string;
  description?: string | null;
  assignedToUserId: string;
  priority: 'MEDIUM';
  dueDate?: string | null;
  reminderAt?: string | null;
  reminderFrequency: 'ONCE';
  sourceMeetingNoteId: string;
}

type MeetingTaskCreatePort = (
  associationId: string,
  inputs: MeetingTaskCreateInput[],
  actingUserId: string,
) => Promise<Array<{ id: string }>>;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}.${mm}.${yy}`;
}

async function canManageMeeting(
  prisma: PrismaService,
  userId: string,
  associationId: string,
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSystemAdmin: true },
  });
  if (user?.isSystemAdmin) return true;

  const membership = await prisma.associationMembership.findFirst({
    where: { userId, associationId, isActive: true, deletedAt: null },
    select: { role: true },
  });
  if (
    membership?.role === UserRole.ASSOCIATION_MANAGER ||
    membership?.role === UserRole.ASSOCIATION_SECRETARY
  ) {
    return true;
  }
  if (!membership) return false;

  return (
    (await prisma.permission.count({
      where: { userId, associationId, action: PermissionAction.USE_MEETING_COMMANDS },
    })) > 0
  );
}

export function registerMeetingListCommand(
  bot: Telegraf,
  prisma: PrismaService,
  aiService: AiService,
  createTasks: MeetingTaskCreatePort,
) {
  bot.command('toplantilarim', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: BigInt(fromId) },
      include: { user: true },
    });

    if (!account) {
      return ctx.reply('❌ Telegram hesabın sistemde bağlı değil.\n\nÖnce /link komutunu kullan.');
    }

    const meetings = await prisma.meetingNote.findMany({
      where: {
        deletedAt: null,
        attendees: {
          some: { userId: account.userId },
        },
      },
      take: 20,
      orderBy: { meetingDate: 'desc' },
      include: {
        association: { select: { id: true, name: true } },
        attendees: true,
      },
    });

    if (meetings.length === 0) {
      return ctx.reply(
        '📋 Henüz katıldığın bir toplantı yok.\n\nYeni bir toplantı eklemek için /toplanti yaz.',
      );
    }

    const taskCounts = await prisma.task.groupBy({
      by: ['sourceMeetingNoteId'],
      where: {
        sourceMeetingNoteId: { in: meetings.map((m) => m.id) },
        deletedAt: null,
      },
      _count: true,
    });

    const taskCountMap = new Map(taskCounts.map((t) => [t.sourceMeetingNoteId, t._count]));

    let message = `📋 *Toplantıların*\n\n`;
    meetings.forEach((m, i) => {
      const tc = taskCountMap.get(m.id) ?? 0;
      const taskBadge = tc > 0 ? ` · ${tc} görev` : '';
      message += `*${i + 1}.* ${m.title}${taskBadge}\n`;
    });
    message += `\nBir toplantı seç:`;

    const buttons = meetings.map((m, i) =>
      Markup.button.callback(`${i + 1}`, `mtl:select:${m.id}`),
    );

    const keyboard = Markup.inlineKeyboard(buttons, { columns: 3 });

    return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  });

  bot.action(/^mtl:select:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const meetingId = ctx.match[1];
    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: BigInt(fromId) },
      include: { user: true },
    });

    if (!account) return ctx.answerCbQuery('Hesap bağlı değil');

    const meeting = await prisma.meetingNote.findFirst({
      where: {
        id: meetingId,
        deletedAt: null,
        association: {
          deletedAt: null,
          memberships: {
            some: { userId: account.userId, isActive: true, deletedAt: null },
          },
        },
      },
      include: {
        association: { select: { id: true, name: true } },
        attendees: true,
      },
    });

    if (!meeting) return ctx.answerCbQuery('Toplantı bulunamadı');

    const taskCount = await prisma.task.count({
      where: { sourceMeetingNoteId: meeting.id, deletedAt: null },
    });

    await ctx.answerCbQuery();
    const canManage = await canManageMeeting(prisma, account.userId, meeting.association.id);

    let message = `📝 *${meeting.title}*\n\n`;
    message += `📅 ${fmtDate(meeting.meetingDate.toISOString())}\n`;
    message += `🏢 ${meeting.association.name}\n`;
    message += `👥 ${meeting.attendees.length} katılımcı\n`;
    message += `✅ ${taskCount} görev`;

    sessions.set(fromId, {
      userId: account.userId,
      step: 'detail',
      meetingId: meeting.id,
      associationId: meeting.association.id,
      canManage,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    const actions = [
      [Markup.button.callback('📄 Toplantı Özeti', 'mtl:summary')],
      [Markup.button.callback('📌 Toplantı Görevleri', 'mtl:tasks')],
      ...(canManage
        ? [
            [Markup.button.callback('🤖 Görevleri Çıkar', 'mtl:ai-analyze')],
            [Markup.button.callback('🧭 Sonraki Gündemi Hazırla', 'mtl:agenda')],
          ]
        : []),
      [Markup.button.callback('↩️ Geri', 'mtl:back-to-list')],
      [Markup.button.callback('❌ Kapat', 'mtl:close')],
    ];

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(actions),
    });
  });

  bot.action('mtl:summary', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s?.meetingId || s.expiresAt <= Date.now()) {
      sessions.delete(fromId);
      return ctx.answerCbQuery('Oturum süresi doldu');
    }

    await ctx.answerCbQuery('Özet hazırlanıyor…');
    const meeting = await prisma.meetingNote.findFirst({
      where: { id: s.meetingId, deletedAt: null },
      select: { title: true, content: true },
    });
    if (!meeting) return ctx.reply('❌ Toplantı bulunamadı.');

    try {
      const summary = await aiService.summarizeMeeting(meeting.content);
      let message = `📄 ${meeting.title} — Toplantı Özeti\n\n`;
      message += `${summary.summary.slice(0, 1500)}\n`;
      if (summary.decisions.length > 0) {
        message += '\n✅ Alınan kararlar\n';
        for (const decision of summary.decisions.slice(0, 10)) {
          message += `• ${decision}\n`;
        }
      }
      return ctx.reply(message.slice(0, 3900));
    } catch {
      return ctx.reply('❌ Toplantı özeti şu anda hazırlanamadı. Lütfen daha sonra tekrar dene.');
    }
  });

  bot.action('mtl:tasks', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s?.meetingId || s.expiresAt <= Date.now()) {
      sessions.delete(fromId);
      return ctx.answerCbQuery('Oturum süresi doldu');
    }

    const tasks = await prisma.task.findMany({
      where: { sourceMeetingNoteId: s.meetingId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      take: 20,
      include: { assignedTo: { select: { fullName: true } } },
    });
    await ctx.answerCbQuery();
    if (tasks.length === 0) return ctx.reply('Bu toplantıdan henüz görev oluşturulmadı.');

    const statusIcon: Record<string, string> = {
      PENDING: '⏳',
      IN_PROGRESS: '🔄',
      COMPLETED: '✅',
      CANCELLED: '❌',
    };
    let message = '📌 Toplantı Görevleri\n\n';
    for (const task of tasks) {
      message += `${statusIcon[task.status] ?? '•'} ${task.title}\n`;
      message += `   👤 ${task.assignedTo.fullName}`;
      if (task.dueDate) message += ` · 📅 ${fmtDate(task.dueDate.toISOString())}`;
      message += '\n\n';
    }
    return ctx.reply(message.slice(0, 3900));
  });

  bot.action('mtl:agenda', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s?.meetingId || !s.canManage || s.expiresAt <= Date.now()) {
      return ctx.answerCbQuery('Bu işlem için aktif toplantı yetkisi gerekli', {
        show_alert: true,
      });
    }

    await ctx.answerCbQuery('Gündem hazırlanıyor…');
    const [meeting, pendingTasks] = await Promise.all([
      prisma.meetingNote.findFirst({
        where: { id: s.meetingId, deletedAt: null },
        select: { title: true, content: true },
      }),
      prisma.task.findMany({
        where: {
          sourceMeetingNoteId: s.meetingId,
          status: { in: ['PENDING', 'IN_PROGRESS'] },
          deletedAt: null,
        },
        orderBy: { dueDate: 'asc' },
        take: 20,
        include: { assignedTo: { select: { fullName: true } } },
      }),
    ]);
    if (!meeting) return ctx.reply('❌ Toplantı bulunamadı.');

    const pendingContext = pendingTasks
      .map(
        (task) =>
          `- ${task.title} — ${task.assignedTo.fullName}` +
          (task.dueDate ? ` — ${fmtDate(task.dueDate.toISOString())}` : ''),
      )
      .join('\n');

    try {
      const result = await aiService.suggestAgenda(
        meeting.content,
        pendingContext || 'Bu toplantıdan kalan açık görev yok.',
      );
      let message = `🧭 ${meeting.title} — Sonraki Toplantı Gündemi\n\n`;
      for (const [index, item] of result.agendaItems.slice(0, 10).entries()) {
        message += `${index + 1}. ${item.title}\n`;
        message += `   ${item.description.slice(0, 220)}\n`;
        message += `   Öncelik: ${item.priority} · Süre: ${item.estimatedDuration} dk\n\n`;
      }
      return ctx.reply(message.slice(0, 3900));
    } catch {
      return ctx.reply('❌ Gündem şu anda hazırlanamadı. Lütfen daha sonra tekrar dene.');
    }
  });

  bot.action('mtl:back-to-list', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: BigInt(fromId) },
      include: { user: true },
    });

    if (!account) return ctx.answerCbQuery('Hesap bağlı değil');

    const meetings = await prisma.meetingNote.findMany({
      where: {
        deletedAt: null,
        attendees: { some: { userId: account.userId } },
      },
      take: 20,
      orderBy: { meetingDate: 'desc' },
      include: { association: { select: { id: true, name: true } }, attendees: true },
    });

    if (meetings.length === 0) {
      sessions.delete(fromId);
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return ctx.reply('📋 Henüz katıldığın bir toplantı yok.');
    }

    const taskCounts = await prisma.task.groupBy({
      by: ['sourceMeetingNoteId'],
      where: { sourceMeetingNoteId: { in: meetings.map((m) => m.id) }, deletedAt: null },
      _count: true,
    });

    const taskCountMap = new Map(taskCounts.map((t) => [t.sourceMeetingNoteId, t._count]));

    let message = `📋 *Toplantıların*\n\n`;
    meetings.forEach((m, i) => {
      const tc = taskCountMap.get(m.id) ?? 0;
      const taskBadge = tc > 0 ? ` · ${tc} görev` : '';
      message += `*${i + 1}.* ${m.title}${taskBadge}\n`;
    });
    message += `\nBir toplantı seç:`;

    const buttons = meetings.map((m, i) =>
      Markup.button.callback(`${i + 1}`, `mtl:select:${m.id}`),
    );

    const keyboard = Markup.inlineKeyboard(buttons, { columns: 3 });

    sessions.delete(fromId);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  });

  bot.action('mtl:ai-analyze', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = sessions.get(fromId);
    if (!s || !s.meetingId || !s.associationId || s.expiresAt <= Date.now()) {
      sessions.delete(fromId);
      return ctx.answerCbQuery('Oturum süresi doldu');
    }
    if (!s.canManage) {
      return ctx.answerCbQuery('Bu işlem için toplantı yetkisi gerekli', {
        show_alert: true,
      });
    }

    await ctx.answerCbQuery('Analiz yapılıyor…');

    try {
      const meeting = await prisma.meetingNote.findFirst({
        where: { id: s.meetingId, deletedAt: null },
      });

      if (!meeting) {
        return ctx.reply('❌ Toplantı bulunamadı.');
      }

      const memberships = await prisma.associationMembership.findMany({
        where: { associationId: s.associationId, isActive: true, deletedAt: null },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              telegramAccount: { select: { userId: true } },
            },
          },
          titleAssignments: {
            include: { title: { select: { name: true } } },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      const ROLE_LABEL: Record<string, string> = {
        ASSOCIATION_MANAGER: 'Başkan',
        ASSOCIATION_SECRETARY: 'Sekreter',
        ASSOCIATION_MEMBER: 'Üye',
        SYSTEM_ADMIN: 'Sistem Yöneticisi',
      };

      const members = memberships.map((m) => {
        const primaryTitle = m.titleAssignments.find((t) => t.isPrimary);
        const title = primaryTitle?.customTitle ?? primaryTitle?.title?.name ?? undefined;
        return {
          userId: m.userId,
          fullName: m.user.fullName,
          role: ROLE_LABEL[m.role] ?? m.role,
          title,
          telegramLinked: m.user.telegramAccount !== null,
        };
      });

      const membersContext = memberships
        .map((m) => {
          const primary = m.titleAssignments.find((t) => t.isPrimary);
          const titlePart = primary?.customTitle ?? primary?.title?.name ?? 'Atanmamış';
          return `- ${m.user.fullName} (userId: ${m.user.id})\n  Rol: ${ROLE_LABEL[m.role] ?? m.role}\n  ÜNvan: ${titlePart}`;
        })
        .join('\n');

      const result = await aiService.extractActionItems(meeting.content, membersContext);

      const now = new Date();
      const aiItems = result.actionItems.map((item, index) => {
        const parsedDueDate = item.dueDateText ? parseTurkishDateText(item.dueDateText, now) : null;
        return {
          index,
          title: item.title,
          description: item.description,
          assignedToUserId: item.assignedToUserId,
          dueDate:
            parsedDueDate && parsedDueDate.getTime() > now.getTime()
              ? parsedDueDate
              : defaultMeetingTaskDueDate(now),
          removed: false,
        };
      });

      s.members = members;
      s.aiItems = aiItems;
      s.step = 'aiReview';
      s.expiresAt = Date.now() + SESSION_TTL_MS;

      const activeItems = aiItems.filter((i) => !i.removed);
      const assignedCount = activeItems.filter((i) => i.assignedToUserId).length;
      const unassignedCount = activeItems.length - assignedCount;

      let message = `🤖 *AI Analizi Sonuçları*\n\n`;
      message += `_${activeItems.length} görev çıkarıldı_\n`;
      message += `✅ ${assignedCount} atanmış`;
      if (unassignedCount > 0) {
        message += ` · ⚠️ ${unassignedCount} atanmamış`;
      }
      message += '\n\n';
      message += '━━━━━━━━━━━━━━━━━━\n\n';

      for (const item of activeItems) {
        const num = item.index + 1;
        const member = members.find((m) => m.userId === item.assignedToUserId);
        const assigneeName = member ? member.fullName : 'Atanmamış';
        const assigneeTitle = member?.title ? ` (${member.title})` : '';
        const assigneeRole = member ? ` [${member.role}]` : '';
        const warnIcon = item.assignedToUserId ? '' : '⚠️ ';

        message += `*${num}. ${item.title}*\n`;
        if (item.description) {
          message += `_${item.description.slice(0, 150)}${item.description.length > 150 ? '...' : ''}_\n`;
        }
        message += `👤 ${warnIcon}${assigneeName}${assigneeRole}${assigneeTitle}`;
        if (item.dueDate) {
          message += ` · 📅 ${fmtDate(item.dueDate.toISOString())}`;
        }
        if (member && !member.telegramLinked) {
          message += ' · ⚠️ Telegram bağlı değil';
        }
        message += '\n\n';
      }

      message += '━━━━━━━━━━━━━━━━━━\n';
      message += '👤 Atamayı değiştirmek için butona bas';

      const keyboard = Markup.inlineKeyboard([
        ...aiItems
          .filter((i) => !i.removed)
          .map((item) => {
            const member = members.find((m) => m.userId === item.assignedToUserId);
            const label = member ? member.fullName : 'Atanmamış';
            return [
              Markup.button.callback(`👤 ${label}`, `mtl:ai-assign:${item.index}`),
              Markup.button.callback('🗑', `mtl:ai-remove:${item.index}`),
            ];
          }),
        [
          Markup.button.callback('✅ Kaydet', 'mtl:ai-save'),
          Markup.button.callback('❌ İptal', 'mtl:ai-cancel'),
        ],
      ]);

      return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return ctx.reply(`❌ AI analizi başarısız: ${msg}`);
    }
  });

  bot.action('mtl:close', async (ctx) => {
    const fromId = ctx.from?.id;
    if (fromId) sessions.delete(fromId);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply('👋');
  });

  bot.action('mtl:ai-cancel', async (ctx) => {
    const fromId = ctx.from?.id;
    if (fromId) sessions.delete(fromId);
    await ctx.answerCbQuery('İptal');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply('AI analizi iptal edildi.');
  });

  bot.action(/^mtl:ai-assign:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiReview') return ctx.answerCbQuery('Oturum bulunamadı');

    const memberships = await prisma.associationMembership.findMany({
      where: { associationId: s.associationId, isActive: true, deletedAt: null },
      include: {
        user: { select: { id: true, fullName: true } },
        titleAssignments: {
          include: { title: { select: { name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    let message = `📋 *Atanacak kişi*\n\n`;
    memberships.forEach((m, i) => {
      const primary = m.titleAssignments.find((t) => t.isPrimary);
      const title = primary?.customTitle ?? primary?.title?.name;
      const titlePart = title ? ` · ${title}` : '';
      message += `*${i + 1}.* ${m.user.fullName}${titlePart}\n`;
    });
    message += `\nNumaraya tıkla:`;

    const buttons = memberships.map((m, i) =>
      Markup.button.callback(`${i + 1}`, `mtl:ai-assign-set:${ctx.match[1]}:${m.userId}`),
    );

    const keyboard = Markup.inlineKeyboard(buttons, { columns: 3 });

    await ctx.answerCbQuery();
    return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  });

  bot.action(/^mtl:ai-assign-set:(\d+):(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = sessions.get(fromId);
    if (!s || !s.aiItems) return ctx.answerCbQuery('Oturum bulunamadı');

    const itemIndex = parseInt(ctx.match[1], 10);
    const userId = ctx.match[2];

    const item = s.aiItems.find((i) => i.index === itemIndex);
    if (!item) return ctx.answerCbQuery('Görev bulunamadı');

    item.assignedToUserId = userId;

    s.step = 'aiReview';

    const member = s.members?.find((m) => m.userId === userId);
    const name = member ? member.fullName : 'Bilinmeyen';

    await ctx.answerCbQuery(`✅ ${name}`);

    const activeItems = s.aiItems.filter((i) => !i.removed);
    let message = `🤖 *AI Analizi Sonuçları*\n\n`;

    for (const it of activeItems) {
      const num = it.index + 1;
      const m = s.members?.find((mem) => mem.userId === it.assignedToUserId);
      const assigneeName = m ? m.fullName : 'Atanmamış';
      const assigneeTitle = m?.title ? ` (${m.title})` : '';
      const assigneeRole = m ? ` [${m.role}]` : '';

      message += `*${num}. ${it.title}*\n`;
      message += `👤 ${assigneeName}${assigneeRole}${assigneeTitle}`;
      if (it.dueDate) {
        message += ` · 📅 ${fmtDate(it.dueDate.toISOString())}`;
      }
      message += '\n\n';
    }

    const keyboard = Markup.inlineKeyboard([
      ...activeItems.map((it) => {
        const m = s.members?.find((mem) => mem.userId === it.assignedToUserId);
        const label = m ? m.fullName : 'Atanmamış';
        return [
          Markup.button.callback(`👤 ${label}`, `mtl:ai-assign:${it.index}`),
          Markup.button.callback('🗑', `mtl:ai-remove:${it.index}`),
        ];
      }),
      [
        Markup.button.callback('✅ Kaydet', 'mtl:ai-save'),
        Markup.button.callback('❌ İptal', 'mtl:ai-cancel'),
      ],
    ]);

    return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  });

  bot.action(/^mtl:ai-remove:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiReview' || !s.aiItems) return ctx.answerCbQuery('Oturum bulunamadı');

    const itemIndex = parseInt(ctx.match[1], 10);
    const item = s.aiItems.find((i) => i.index === itemIndex);
    if (!item) return ctx.answerCbQuery('Görev bulunamadı');

    item.removed = true;

    await ctx.answerCbQuery('🗑 Kaldırıldı');

    const activeItems = s.aiItems.filter((i) => !i.removed);
    if (activeItems.length === 0) {
      return ctx.reply('Tüm görevler kaldırıldı.');
    }

    let message = `🤖 *AI Analizi Sonuçları*\n\n`;
    message += `_${activeItems.length} görev kaldı_\n\n`;

    for (const it of activeItems) {
      const num = it.index + 1;
      const m = s.members?.find((mem) => mem.userId === it.assignedToUserId);
      const assigneeName = m ? m.fullName : 'Atanmamış';
      const assigneeTitle = m?.title ? ` (${m.title})` : '';

      message += `*${num}. ${it.title}*\n`;
      message += `👤 ${assigneeName}${assigneeTitle}`;
      if (it.dueDate) {
        message += ` · 📅 ${fmtDate(it.dueDate.toISOString())}`;
      }
      message += '\n\n';
    }

    const keyboard = Markup.inlineKeyboard([
      ...activeItems.map((it) => {
        const m = s.members?.find((mem) => mem.userId === it.assignedToUserId);
        const label = m ? m.fullName : 'Atanmamış';
        return [
          Markup.button.callback(`👤 ${label}`, `mtl:ai-assign:${it.index}`),
          Markup.button.callback('🗑', `mtl:ai-remove:${it.index}`),
        ];
      }),
      [
        Markup.button.callback('✅ Kaydet', 'mtl:ai-save'),
        Markup.button.callback('❌ İptal', 'mtl:ai-cancel'),
      ],
    ]);

    return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
  });

  bot.action('mtl:ai-save', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiReview' || !s.aiItems) return ctx.answerCbQuery('Oturum bulunamadı');

    const activeItems = s.aiItems.filter((i) => !i.removed && i.assignedToUserId);

    if (activeItems.length === 0) {
      sessions.delete(fromId);
      await ctx.answerCbQuery();
      return ctx.reply('Kaydedilecek atanmış görev yok.');
    }

    if (!s.meetingId || !s.associationId) {
      return ctx.reply('❌ Oturum hatası: Toplantı bilgisi eksik.');
    }

    try {
      await createTasks(
        s.associationId,
        activeItems.map((item) => ({
          title: item.title,
          description: item.description ?? null,
          assignedToUserId: item.assignedToUserId!,
          sourceMeetingNoteId: s.meetingId!,
          priority: 'MEDIUM',
          dueDate: item.dueDate?.toISOString() ?? null,
          reminderAt: item.dueDate ? reminderAtForDueDate(item.dueDate).toISOString() : null,
          reminderFrequency: 'ONCE',
        })),
        s.userId,
      );

      sessions.delete(fromId);
      await ctx.answerCbQuery('Kaydedildi');
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      const linkedCount = activeItems.filter((item) =>
        s.members?.some(
          (member) => member.userId === item.assignedToUserId && member.telegramLinked,
        ),
      ).length;
      const unlinkedNames = activeItems
        .map((item) => s.members?.find((member) => member.userId === item.assignedToUserId))
        .filter((member) => member && !member.telegramLinked)
        .map((member) => member!.fullName);
      let resultMessage =
        `✅ ${activeItems.length} görev kaydedildi.\n\n` +
        `${linkedCount} görev için Telegram kabul/itiraz mesajı gönderiliyor.`;
      if (unlinkedNames.length > 0) {
        resultMessage +=
          `\n\n⚠️ Telegram hesabı bağlı olmadığı için mesaj alamayanlar: ` +
          [...new Set(unlinkedNames)].join(', ');
      }
      return ctx.reply(resultMessage);
    } catch (err) {
      console.error('[BOT] mtl:ai-save - error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      return ctx.reply(`❌ Kaydetme başarısız: ${msg}`);
    }
  });
}

function defaultMeetingTaskDueDate(now = new Date()): Date {
  const due = new Date(now);
  due.setUTCDate(due.getUTCDate() + 7);
  due.setUTCHours(17, 0, 0, 0); // 20:00 Europe/Istanbul
  return due;
}

function reminderAtForDueDate(dueDate: Date, now = new Date()): Date {
  const oneDayBefore = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
  if (oneDayBefore.getTime() > now.getTime()) return oneDayBefore;

  const shortlyAfterNow = new Date(now.getTime() + 5 * 60 * 1000);
  return shortlyAfterNow.getTime() < dueDate.getTime() ? shortlyAfterNow : now;
}

function parseTurkishDateText(text: string | null | undefined, ref: Date): Date | null {
  if (!text?.trim()) return null;
  const s = text.toLowerCase().trim();
  const refYear = ref.getUTCFullYear();

  const AI_DATE_MONTHS: Record<string, number> = {
    ocak: 0,
    şubat: 1,
    mart: 2,
    nisan: 3,
    mayıs: 4,
    haziran: 5,
    temmuz: 6,
    ağustos: 7,
    eylül: 8,
    ekim: 9,
    kasım: 10,
    aralık: 11,
  };

  const dayMonthYear = s.match(
    /(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)(?:\s+(\d{4}))?/,
  );
  if (dayMonthYear) {
    const day = parseInt(dayMonthYear[1], 10);
    const month = AI_DATE_MONTHS[dayMonthYear[2]];
    const year = dayMonthYear[3] ? parseInt(dayMonthYear[3], 10) : refYear;
    return new Date(Date.UTC(year, month, day, 17, 0, 0));
  }

  return null;
}
