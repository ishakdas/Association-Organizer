import { Telegraf, Markup } from 'telegraf';
import { PrismaService, UserRole, TaskPriority } from '@ticketbot/database';
import { BotService } from '../bot.service';
import { escapeMarkdown } from '../utils/message-formatter';

interface TaskCreateSession {
  userId: string;
  associationId: string;
  step: 'association' | 'title' | 'description' | 'assignee' | 'priority' | 'dueDate' | 'confirm';
  title?: string;
  description?: string;
  assignedToUserId?: string;
  priority?: TaskPriority;
  dueDate?: string;
  expiresAt: number;
}

const taskCreateSessions = new Map<number, TaskCreateSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;

// Görev oluşturma sihirbazının bu kullanıcı için son aktivite zamanı (epoch
// ms) veya yoksa null. Diğer metin-yakalayan handler'lar (ör. görev listesi
// numara girişi) "en son hangi akış kullanıldıysa o kazanır" kararı için
// kullanır. lastActivity = expiresAt - TTL.
export function taskCreateSessionActivity(telegramId: number): number | null {
  const s = taskCreateSessions.get(telegramId);
  if (!s) return null;
  if (s.expiresAt <= Date.now()) {
    taskCreateSessions.delete(telegramId);
    return null;
  }
  return s.expiresAt - SESSION_TTL_MS;
}

const PRIORITY_MAP: Record<string, TaskPriority> = {
  'Düşük': TaskPriority.LOW,
  'Orta': TaskPriority.MEDIUM,
  'Yüksek': TaskPriority.HIGH,
};

export function registerTaskCreateWizard(bot: Telegraf, prisma: PrismaService, botService: BotService) {
  bot.command('gorev', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;

    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: BigInt(fromId) },
      include: { user: true },
    });

    if (!account) {
      return ctx.reply('❌ Telegram hesabın sistemde bağlı değil.\n\nÖnce /link komutunu kullan.');
    }

    const memberships = await prisma.associationMembership.findMany({
      where: {
        userId: account.userId,
        isActive: true,
        deletedAt: null,
        role: { in: [UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY] },
      },
      include: { association: { select: { id: true, name: true } } },
    });

    if (memberships.length === 0) {
      return ctx.reply('📋 Görev oluşturmak için Başkan veya Sekreter yetkisine sahip olmalısın.');
    }

    // Birden fazla dernekte yetkiliyse önce dernek seçtir; tek dernek
    // varsa doğrudan başlığa geç.
    if (memberships.length > 1) {
      taskCreateSessions.set(fromId, {
        userId: account.userId,
        associationId: '',
        step: 'association',
        expiresAt: Date.now() + SESSION_TTL_MS,
      });
      const buttons = memberships.map((m) => [
        Markup.button.callback(
          m.association.name,
          `tcreate:assoc:${m.association.id}`,
        ),
      ]);
      buttons.push([Markup.button.callback('❌ İptal', 'tcreate:cancel')]);
      return ctx.reply('🏢 Hangi dernek için görev oluşturacaksın?', {
        ...Markup.inlineKeyboard(buttons),
      });
    }

    const assoc = memberships[0].association;
    taskCreateSessions.set(fromId, {
      userId: account.userId,
      associationId: assoc.id,
      step: 'title',
      expiresAt: Date.now() + SESSION_TTL_MS,
    });

    return ctx.reply(
      `📝 *${escapeMarkdown(assoc.name)}* - Yeni Görev Oluştur\n\nGörev başlığını yaz:`,
      { parse_mode: 'Markdown', ...Markup.removeKeyboard() },
    );
  });

  // Dernek seçimi (çok-dernekli yetkili).
  bot.action(/^tcreate:assoc:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const session = taskCreateSessions.get(fromId);
    if (!session) return ctx.answerCbQuery('Oturum bulunamadı');

    const associationId = ctx.match[1];

    // Seçilen dernekte hâlâ yetkili mi, doğrula.
    const membership = await prisma.associationMembership.findFirst({
      where: {
        userId: session.userId,
        associationId,
        isActive: true,
        deletedAt: null,
        role: { in: [UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY] },
      },
      include: { association: { select: { name: true } } },
    });
    if (!membership) {
      return ctx.answerCbQuery('Bu dernekte yetkiniz yok');
    }

    session.associationId = associationId;
    session.step = 'title';
    await ctx.answerCbQuery();
    return ctx.editMessageText(
      `📝 *${escapeMarkdown(membership.association.name)}* - Yeni Görev Oluştur\n\nGörev başlığını yaz:`,
      { parse_mode: 'Markdown' },
    );
  });

  bot.on('text', async (ctx, next) => {
    const fromId = ctx.from?.id;
    if (!fromId) return next();

    const session = taskCreateSessions.get(fromId);
    if (!session) return next();

    if (Date.now() > session.expiresAt) {
      taskCreateSessions.delete(fromId);
      return ctx.reply('⏰ Oturum süresi doldu. Tekrar /gorev komutunu kullan.');
    }

    const text = ctx.message.text.trim();

    if (text === '/iptal' || text.toLowerCase() === 'iptal') {
      taskCreateSessions.delete(fromId);
      return ctx.reply('👍 Görev oluşturma iptal edildi.', Markup.removeKeyboard());
    }

    switch (session.step) {
      case 'title':
        if (text.length < 2) {
          return ctx.reply('⚠️ Başlık en az 2 karakter olmalı. Tekrar yaz:');
        }
        if (text.length > 200) {
          return ctx.reply('⚠️ Başlık en fazla 200 karakter olabilir. Kısaltarak tekrar yaz:');
        }
        session.title = text;
        session.step = 'description';
        return ctx.reply(
          `📝 Başlık: *${text}*\n\nGörev açıklamasını yaz (boş geçmek için "boş" yaz):`,
          { parse_mode: 'Markdown' },
        );

      case 'description':
        if (text.toLowerCase() !== 'boş') {
          session.description = text.length > 2000 ? text.slice(0, 2000) : text;
        }
        session.step = 'assignee';
        return showAssigneeSelection(ctx, prisma, fromId, session);

      case 'dueDate': {
        if (text.toLowerCase() === 'boş') {
          session.dueDate = undefined;
          session.step = 'confirm';
          return showConfirmation(ctx, prisma, fromId, session);
        }
        const parsed = parseDateInput(text);
        if (!parsed) {
          return ctx.reply(
            '⚠️ Geçersiz tarih formatı. Örnekler:\n' +
            '• `25.05.2025` (gün.ay.yıl)\n' +
            '• `2025-05-25` (yıl-ay-gün)\n' +
            '• `boş` (tarih belirtme)',
          );
        }
        if (parsed <= new Date()) {
          return ctx.reply('⚠️ Bitiş tarihi gelecekte olmalı. Yeni bir tarih yaz:');
        }
        session.dueDate = parsed.toISOString();
        session.step = 'confirm';
        return showConfirmation(ctx, prisma, fromId, session);
      }

      default:
        return next();
    }
  });

  bot.action(/^tcreate:assign:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const session = taskCreateSessions.get(fromId);
    if (!session) return ctx.answerCbQuery('Oturum bulunamadı');

    session.assignedToUserId = ctx.match[1];
    session.step = 'priority';
    await ctx.answerCbQuery();
    return showPrioritySelection(ctx, fromId);
  });

  bot.action(/^tcreate:assignpage:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const session = taskCreateSessions.get(fromId);
    if (!session) return ctx.answerCbQuery('Oturum bulunamadı');

    const page = parseInt(ctx.match[1], 10);
    await ctx.answerCbQuery();
    return showAssigneeSelection(ctx, prisma, fromId, session, page, true);
  });

  bot.action('tcreate:priority:LOW', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const session = taskCreateSessions.get(fromId);
    if (!session) return ctx.answerCbQuery('Oturum bulunamadı');

    session.priority = TaskPriority.LOW;
    session.step = 'dueDate';
    await ctx.answerCbQuery();
    return ctx.editMessageText(
      `📝 Öncelik: *Düşük*\n\nBitiş tarihi yaz (boş geçmek için "boş" yaz):\n` +
      '• `25.05.2025` (gün.ay.yıl)\n' +
      '• `2025-05-25` (yıl-ay-gün)\n' +
      '• `boş` (tarih belirtme)',
      { parse_mode: 'Markdown' },
    );
  });

  bot.action('tcreate:priority:MEDIUM', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const session = taskCreateSessions.get(fromId);
    if (!session) return ctx.answerCbQuery('Oturum bulunamadı');

    session.priority = TaskPriority.MEDIUM;
    session.step = 'dueDate';
    await ctx.answerCbQuery();
    return ctx.editMessageText(
      `📝 Öncelik: *Orta*\n\nBitiş tarihi yaz (boş geçmek için "boş" yaz):\n` +
      '• `25.05.2025` (gün.ay.yıl)\n' +
      '• `2025-05-25` (yıl-ay-gün)\n' +
      '• `boş` (tarih belirtme)',
      { parse_mode: 'Markdown' },
    );
  });

  bot.action('tcreate:priority:HIGH', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const session = taskCreateSessions.get(fromId);
    if (!session) return ctx.answerCbQuery('Oturum bulunamadı');

    session.priority = TaskPriority.HIGH;
    session.step = 'dueDate';
    await ctx.answerCbQuery();
    return ctx.editMessageText(
      `📝 Öncelik: *Yüksek*\n\nBitiş tarihi yaz (boş geçmek için "boş" yaz):\n` +
      '• `25.05.2025` (gün.ay.yıl)\n' +
      '• `2025-05-25` (yıl-ay-gün)\n' +
      '• `boş` (tarih belirtme)',
      { parse_mode: 'Markdown' },
    );
  });

  bot.action('tcreate:confirm', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const session = taskCreateSessions.get(fromId);
    if (!session || !session.title || !session.assignedToUserId) {
      return ctx.answerCbQuery('Eksik bilgi');
    }

    await ctx.answerCbQuery();

    try {
      const created = await botService.createTask(
        session.associationId,
        {
          title: session.title,
          description: session.description ?? null,
          assignedToUserId: session.assignedToUserId,
          priority: session.priority ?? TaskPriority.MEDIUM,
          dueDate: session.dueDate ?? null,
        },
        session.userId,
      );

      taskCreateSessions.delete(fromId);

      // TasksService.create atama bildirimini (Kabul/İtiraz klavyesi) ve
      // hatırlatma işlerini kendisi kurar; burada yalnızca özet gösteriyoruz.
      return ctx.editMessageText(
        `✅ *Görev Oluşturuldu!*\n\n` +
        `📝 Başlık: *${escapeMarkdown(created.title)}*\n` +
        `👤 Atanan: *${escapeMarkdown(created.assignedTo?.fullName ?? '—')}*\n` +
        `📌 Öncelik: ${priorityLabel(session.priority ?? TaskPriority.MEDIUM)}\n` +
        (created.dueDate ? `📅 Bitiş: ${fmtDate(created.dueDate.toISOString())}\n` : '') +
        `\nℹ️ Atanan kişiye (Telegram bağlıysa) bildirim ve hatırlatma ayarlandı.`,
        { parse_mode: 'Markdown' },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      return ctx.editMessageText(
        `❌ Görev oluşturulamadı: ${escapeMarkdown(msg)}`,
      );
    }
  });

  bot.action('tcreate:cancel', async (ctx) => {
    const fromId = ctx.from?.id;
    if (fromId) taskCreateSessions.delete(fromId);
    await ctx.answerCbQuery();
    return ctx.editMessageText('👍 Görev oluşturma iptal edildi.');
  });
}

function parseDateInput(text: string): Date | null {
  const dotMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dotMatch) {
    const [, day, month, year] = dotMatch;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  const dashMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (dashMatch) {
    const [, year, month, day] = dashMatch;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T23:59:59Z`);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}.${mm}.${yy}`;
}

function priorityLabel(p: TaskPriority): string {
  switch (p) {
    case TaskPriority.HIGH: return '🔴 Yüksek';
    case TaskPriority.LOW: return '🟢 Düşük';
    default: return '🟡 Orta';
  }
}

const MEMBERS_PER_PAGE = 8;

async function showAssigneeSelection(
  ctx: any,
  prisma: PrismaService,
  fromId: number,
  session: TaskCreateSession,
  page: number = 0,
  editMode: boolean = false,
) {
  const assoc = await prisma.association.findUnique({
    where: { id: session.associationId },
    select: { name: true },
  });

  if (!assoc) return ctx.reply('❌ Dernek bulunamadı.');

  const memberships = await prisma.associationMembership.findMany({
    where: { associationId: session.associationId, isActive: true, deletedAt: null },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { user: { fullName: 'asc' } },
  });

  if (memberships.length === 0) {
    taskCreateSessions.delete(fromId);
    return ctx.reply('❌ Bu derneğin aktif üyesi yok.');
  }

  const totalPages = Math.ceil(memberships.length / MEMBERS_PER_PAGE);
  const startIdx = page * MEMBERS_PER_PAGE;
  const endIdx = Math.min(startIdx + MEMBERS_PER_PAGE, memberships.length);
  const pageMembers = memberships.slice(startIdx, endIdx);

  let message = `📝 *${assoc.name}* - Görev Atama\n\n`;
  message += `Başlık: *${session.title}*\n`;
  message += `Sayfa *${page + 1}/${totalPages}*\n\n`;
  message += `Görevi kime atayacaksın?`;

  const buttons = pageMembers.map((m) => [
    Markup.button.callback(m.user.fullName, `tcreate:assign:${m.userId}`),
  ]);

  const navButtons: any[] = [];
  const row: any[] = [];
  if (page > 0) row.push(Markup.button.callback('⬅️', `tcreate:assignpage:${page - 1}`));
  if (page < totalPages - 1) row.push(Markup.button.callback('➡️', `tcreate:assignpage:${page + 1}`));
  if (row.length > 0) navButtons.push(row);
  navButtons.push([Markup.button.callback('❌ İptal', 'tcreate:cancel')]);

  const keyboard = Markup.inlineKeyboard([...buttons, ...navButtons]);

  if (editMode) {
    return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  }
  return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
}

async function showPrioritySelection(ctx: any, fromId: number) {
  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('🔴 Yüksek', 'tcreate:priority:HIGH')],
    [Markup.button.callback('🟡 Orta', 'tcreate:priority:MEDIUM')],
    [Markup.button.callback('🟢 Düşük', 'tcreate:priority:LOW')],
    [Markup.button.callback('❌ İptal', 'tcreate:cancel')],
  ]);

  return ctx.editMessageText('📌 Öncelik seç:', { ...keyboard });
}

async function showConfirmation(
  ctx: any,
  prisma: PrismaService,
  fromId: number,
  session: TaskCreateSession,
) {
  const assignee = await prisma.user.findUnique({
    where: { id: session.assignedToUserId! },
    select: { fullName: true },
  });

  let message = `✅ *Görevi Onayla*\n\n`;
  message += `📝 Başlık: *${session.title}*\n`;
  if (session.description) message += `📄 Açıklama: ${session.description}\n`;
  message += `👤 Atanan: *${assignee?.fullName}*\n`;
  message += `📌 Öncelik: ${priorityLabel(session.priority ?? TaskPriority.MEDIUM)}\n`;
  if (session.dueDate) message += `📅 Bitiş: ${fmtDate(session.dueDate)}\n`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('✅ Oluştur', 'tcreate:confirm')],
    [Markup.button.callback('❌ İptal', 'tcreate:cancel')],
  ]);

  return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
}
