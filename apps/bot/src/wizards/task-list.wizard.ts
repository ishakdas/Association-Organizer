import { Telegraf, Markup } from 'telegraf';
import { PrismaService, PermissionAction } from '@ticketbot/database';
import { reminderActionsKeyboard } from '../keyboards/reminder-actions.keyboard';
import { escapeMarkdown } from '../utils/message-formatter';
import { taskCreateSessionActivity } from './task-create.wizard';
import { financeSessionActivity } from './finance.wizard';
import { meetingSessionActivity } from './meeting.wizard';

const MEMBERS_PER_PAGE = 5;
const TASKS_PER_PAGE = 5;

const taskSessions = new Map<number, {
  userId: string;
  step: 'member' | 'tasks' | 'my-tasks';
  associationId: string;
  memberPage?: number;
  tasksPage?: number;
  // Görüntülenen numara → görev id eşlemesi (liste sırasıyla birebir; numara
  // N -> taskIds[N-1]). Kullanıcı numarayı yazınca aksiyon menüsü açmak için.
  taskIds?: string[];
  // Numaralı listenin en son gösterildiği an (epoch ms). Numara girişinde
  // "liste mi yoksa yarım kalan bir sihirbaz mı daha yeni" kararı için.
  listShownAt?: number;
  expiresAt: number;
}>();

const PRIORITY_LABEL: Record<string, string> = {
  HIGH: '🔴 Yüksek',
  MEDIUM: '🟡 Orta',
  LOW: '🟢 Düşük',
};

const SESSION_TTL_MS = 30 * 60 * 1000;

const STATUS_ICON: Record<string, string> = {
  PENDING: '⏳',
  IN_PROGRESS: '🔄',
  COMPLETED: '✅',
  CANCELLED: '❌',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Bekleyen',
  IN_PROGRESS: 'Devam Eden',
  COMPLETED: 'Tamamlanan',
  CANCELLED: 'İptal',
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}.${mm}.${yy}`;
}

function isManagerOrSecretary(role: string): boolean {
  return role === 'SYSTEM_ADMIN' || role === 'ASSOCIATION_MANAGER' || role === 'ASSOCIATION_SECRETARY';
}

export function registerTaskListCommand(bot: Telegraf, prisma: PrismaService) {
  bot.command('gorevlerim', async (ctx) => {
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
      where: { userId: account.userId, isActive: true, deletedAt: null },
      include: { association: { select: { id: true, name: true } } },
    });

    if (memberships.length === 0) {
      return ctx.reply('📋 Henüz bir derneğe üye değilsin.');
    }

    const eligible: typeof memberships = [];
    const canViewAllByAssoc = new Map<string, boolean>();

    for (const m of memberships) {
      if (isManagerOrSecretary(m.role)) {
        eligible.push(m);
        canViewAllByAssoc.set(m.associationId, true);
        continue;
      }

      const grants = await prisma.permission.findMany({
        where: {
          associationId: m.associationId,
          userId: account.userId,
          action: {
            in: [
              PermissionAction.USE_TASK_COMMANDS,
              PermissionAction.VIEW_ALL_MEMBER_TASKS,
            ],
          },
        },
        select: { action: true },
      });

      if (grants.length > 0) {
        eligible.push(m);
      }
      if (
        grants.some(
          (g) => g.action === PermissionAction.VIEW_ALL_MEMBER_TASKS,
        )
      ) {
        canViewAllByAssoc.set(m.associationId, true);
      }
    }

    if (eligible.length === 0) {
      return ctx.reply('📋 Görevleri görüntülemek için dernekte yetkin yok.');
    }

    const assoc = eligible[0].association;
    const membership = eligible[0];
    const canViewAll =
      isManagerOrSecretary(membership.role) ||
      canViewAllByAssoc.get(assoc.id) === true;

    if (canViewAll) {
      taskSessions.set(fromId, {
        userId: account.userId,
        step: 'member',
        associationId: assoc.id,
        memberPage: 0,
        expiresAt: Date.now() + SESSION_TTL_MS,
      });
      return showMemberSelection(ctx, prisma, fromId, assoc.id, 0);
    }

    taskSessions.set(fromId, {
      userId: account.userId,
      step: 'my-tasks',
      associationId: assoc.id,
      tasksPage: 0,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return showMyTasks(ctx, prisma, fromId, assoc.id, account.userId, 0);
  });

  bot.action(/^gtl:member:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = taskSessions.get(fromId);
    if (!s || !s.associationId) return ctx.answerCbQuery('Oturum bulunamadı');

    const userId = ctx.match[1];
    s.step = 'tasks';
    s.tasksPage = 0;
    s.expiresAt = Date.now() + SESSION_TTL_MS;

    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showMemberTasks(ctx, prisma, fromId, s.associationId, userId, 0);
  });

  bot.action('gtl:back-to-member', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = taskSessions.get(fromId);
    if (!s || !s.associationId) return ctx.answerCbQuery('Oturum bulunamadı');

    s.step = 'member';
    s.tasksPage = undefined;
    s.memberPage = s.memberPage ?? 0;
    s.expiresAt = Date.now() + SESSION_TTL_MS;

    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showMemberSelection(ctx, prisma, fromId, s.associationId, s.memberPage);
  });

  bot.action(/^gtl:tasks:(\d+):(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = taskSessions.get(fromId);
    if (!s || !s.associationId) return ctx.answerCbQuery('Oturum bulunamadı');

    const page = parseInt(ctx.match[1], 10);
    const userId = ctx.match[2];
    s.tasksPage = page;
    s.expiresAt = Date.now() + SESSION_TTL_MS;

    await ctx.answerCbQuery();
    return showMemberTasks(ctx, prisma, fromId, s.associationId, userId, page, true);
  });

  bot.action(/^gtl:mpage:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = taskSessions.get(fromId);
    if (!s || !s.associationId) return ctx.answerCbQuery('Oturum bulunamadı');

    const page = parseInt(ctx.match[1], 10);
    s.memberPage = page;
    s.expiresAt = Date.now() + SESSION_TTL_MS;

    await ctx.answerCbQuery();
    return showMemberSelection(ctx, prisma, fromId, s.associationId, page, true);
  });

  bot.action(/^gtl:mytasks:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();

    const s = taskSessions.get(fromId);
    if (!s || !s.associationId) return ctx.answerCbQuery('Oturum bulunamadı');

    const page = parseInt(ctx.match[1], 10);
    s.tasksPage = page;
    s.expiresAt = Date.now() + SESSION_TTL_MS;

    await ctx.answerCbQuery();
    return showMyTasks(ctx, prisma, fromId, s.associationId, s.userId, page, true);
  });

  bot.action('gtl:close', async (ctx) => {
    const fromId = ctx.from?.id;
    if (fromId) taskSessions.delete(fromId);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply('👋');
  });

  // Liste gösterildikten sonra kullanıcı görev numarasını yazarsa, o görev
  // için aksiyon menüsünü (Tamamla / Ertele / Kapat) aç. Aksiyon butonları
  // tasks-bot.integration.ts'te (task_done / task_snz / task_dismiss) zaten
  // bağlı; burada sadece doğru göreve ait klavyeyi gösteriyoruz.
  bot.on('text', async (ctx, next) => {
    const fromId = ctx.from?.id;
    if (!fromId) return next();

    const s = taskSessions.get(fromId);
    if (!s || !s.taskIds || !s.listShownAt) return next();

    const text = ctx.message.text.trim();
    // Yalnızca düz sayıları yakala; diğer her şeyi sonraki handler'lara bırak.
    if (!/^\d{1,3}$/.test(text)) return next();

    // "En son hangi akış kullanıldıysa o kazanır": başka bir sihirbaz (görev
    // oluşturma / finans / toplantı) metin bekliyor VE o sihirbaz listeden
    // DAHA YENİ etkileşim aldıysa, numarayı ona bırak. Liste daha yeniyse
    // (kullanıcı az önce /gorevlerim yapıp numara yazdıysa) biz işleriz —
    // böylece yarım kalmış eski bir /gorev oturumu numarayı çalmaz.
    const otherActivity = Math.max(
      taskCreateSessionActivity(fromId) ?? -1,
      financeSessionActivity(fromId) ?? -1,
      meetingSessionActivity(fromId) ?? -1,
    );
    if (otherActivity > s.listShownAt) {
      return next();
    }

    if (s.expiresAt <= Date.now()) {
      taskSessions.delete(fromId);
      return next();
    }

    const num = parseInt(text, 10);
    const taskId = s.taskIds[num];
    if (!taskId) {
      return ctx.reply(
        `⚠️ ${num} numaralı görev bu listede yok. Listedeki bir numara yaz.`,
      );
    }

    return showTaskActions(ctx, prisma, taskId, s.userId);
  });
}

// Tek bir görevin özetini + aksiyon klavyesini gösterir. Yetki: işlemi yapan
// ya görevin sahibi (assignee) ya da derneğde yönetici/sekreter olmalı —
// servis katmanı (markCompletedViaBot vb.) zaten doğruluyor; burada sadece
// görünürlük için derneğe ait olup olmadığına bakıyoruz.
async function showTaskActions(
  ctx: any,
  prisma: PrismaService,
  taskId: string,
  viewerUserId: string,
) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
    include: { assignedTo: { select: { fullName: true } } },
  });

  if (!task) {
    return ctx.reply('❌ Görev bulunamadı (silinmiş olabilir).');
  }

  const icon = STATUS_ICON[task.status] ?? '📌';
  const statusLabel = STATUS_LABEL[task.status] ?? task.status;

  let message = `${icon} *${escapeMarkdown(task.title)}*\n\n`;
  if (task.description) {
    const desc =
      task.description.length > 300
        ? task.description.slice(0, 300) + '…'
        : task.description;
    message += `${escapeMarkdown(desc)}\n\n`;
  }
  message += `Durum: *${statusLabel}*\n`;
  message += `Öncelik: ${PRIORITY_LABEL[task.priority] ?? task.priority}\n`;
  message += `Atanan: *${escapeMarkdown(task.assignedTo?.fullName ?? '—')}*\n`;
  if (task.dueDate) {
    message += `Bitiş: 📅 ${fmtDate(task.dueDate.toISOString())}\n`;
  }

  // Kapalı görevlerde aksiyon klavyesi gösterme.
  if (task.status === 'COMPLETED' || task.status === 'CANCELLED') {
    return ctx.reply(message + `\n_Bu görev kapalı; işlem yapılamaz._`, {
      parse_mode: 'Markdown',
    });
  }

  const keyboard = reminderActionsKeyboard(task.id).reply_markup;
  return ctx.reply(message, { parse_mode: 'Markdown', reply_markup: keyboard });
}

async function showMyTasks(
  ctx: any,
  prisma: PrismaService,
  fromId: number,
  associationId: string,
  userId: string,
  page: number = 0,
  editMode: boolean = false,
) {
  const assoc = await prisma.association.findUnique({
    where: { id: associationId },
    select: { name: true },
  });

  if (!assoc) return ctx.reply('❌ Dernek bulunamadı.');

  const tasks = await prisma.task.findMany({
    where: { associationId, assignedToUserId: userId, deletedAt: null },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  if (tasks.length === 0) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('❌ Kapat', 'gtl:close')],
    ]);

    if (editMode) {
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return ctx.reply(
        `📋 *${assoc.name}* - Görevlerim\n\nHenüz atanmış görev yok.`,
        { parse_mode: 'Markdown', ...keyboard },
      );
    }
    return ctx.reply(
      `📋 *${assoc.name}* - Görevlerim\n\nHenüz atanmış görev yok.`,
      { parse_mode: 'Markdown', ...keyboard },
    );
  }

  const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);
  const startIdx = page * TASKS_PER_PAGE;
  const endIdx = Math.min(startIdx + TASKS_PER_PAGE, tasks.length);
  const pageTasks = tasks.slice(startIdx, endIdx);

  const grouped = new Map<string, typeof tasks>();
  for (const t of pageTasks) {
    const arr = grouped.get(t.status) ?? [];
    arr.push(t);
    grouped.set(t.status, arr);
  }

  let message = `📋 *${assoc.name}* - Görevlerim\n`;
  message += `Toplam: *${tasks.length} görev* · Sayfa *${page + 1}/${totalPages}*\n\n`;

  const statusOrder = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  let globalNum = startIdx + 1;
  // Numara → görev id eşlemesi; mesajda görünen sırayla dolduruyoruz.
  const numberedIds: string[] = [];

  for (const status of statusOrder) {
    const items = grouped.get(status);
    if (!items || items.length === 0) continue;

    const icon = STATUS_ICON[status] ?? '📌';
    const label = STATUS_LABEL[status] ?? status;
    message += `${icon} *${label}* (${items.length})\n`;

    for (const t of items) {
      const title = t.title.length > 40 ? t.title.slice(0, 40) + '…' : t.title;
      message += `  ${globalNum}. ${title}`;
      if (t.dueDate) {
        message += ` · 📅 ${fmtDate(t.dueDate.toISOString())}`;
      }
      message += '\n';
      numberedIds[globalNum] = t.id;
      globalNum++;
    }
    message += '\n';
  }

  message += `_İşlem için görev numarasını yaz (örn. ${startIdx + 1}). Tamamla / Ertele seçenekleri açılır._`;

  const s = taskSessions.get(fromId);
  if (s) {
    s.taskIds = numberedIds;
    s.listShownAt = Date.now();
    s.expiresAt = Date.now() + SESSION_TTL_MS;
  }

  const navButtons: any[] = [];
  const row: any[] = [];

  if (page > 0) {
    row.push(Markup.button.callback('⬅️ Önceki', `gtl:mytasks:${page - 1}`));
  }
  if (page < totalPages - 1) {
    row.push(Markup.button.callback('Sonraki ➡️', `gtl:mytasks:${page + 1}`));
  }
  if (row.length > 0) navButtons.push(row);

  navButtons.push([Markup.button.callback('❌ Kapat', 'gtl:close')]);

  const keyboard = Markup.inlineKeyboard(navButtons);

  if (editMode) {
    return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  }
  return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
}

async function showMemberSelection(
  ctx: any,
  prisma: PrismaService,
  fromId: number,
  associationId: string,
  page: number = 0,
  editMode: boolean = false,
) {
  const assoc = await prisma.association.findUnique({
    where: { id: associationId },
    select: { name: true },
  });

  if (!assoc) return ctx.reply('❌ Dernek bulunamadı.');

  const memberships = await prisma.associationMembership.findMany({
    where: { associationId, isActive: true, deletedAt: null },
    include: { user: { select: { id: true, fullName: true } } },
    orderBy: { user: { fullName: 'asc' } },
  });

  if (memberships.length === 0) {
    return ctx.reply('📋 Bu derneğin aktif üyesi yok.');
  }

  const taskCounts = await prisma.task.groupBy({
    by: ['assignedToUserId'],
    where: { associationId, deletedAt: null },
    _count: true,
  });

  const countMap = new Map(taskCounts.map((t) => [t.assignedToUserId, t._count]));

  const totalPages = Math.ceil(memberships.length / MEMBERS_PER_PAGE);
  const startIdx = page * MEMBERS_PER_PAGE;
  const endIdx = Math.min(startIdx + MEMBERS_PER_PAGE, memberships.length);
  const pageMembers = memberships.slice(startIdx, endIdx);

  let message = `📋 *${assoc.name}* - Görevleri\n`;
  message += `Toplam: *${memberships.length} üye* · Sayfa *${page + 1}/${totalPages}*\n\n`;
  message += `Kimin görevlerini görmek istersin?\n\n`;

  pageMembers.forEach((m, i) => {
    const globalIdx = startIdx + i + 1;
    const tc = countMap.get(m.userId) ?? 0;
    const badge = tc > 0 ? ` · ${tc} görev` : '';
    message += `*${globalIdx}.* ${m.user.fullName}${badge}\n`;
  });

  const buttons = pageMembers.map((m, i) => {
    const globalIdx = startIdx + i + 1;
    return Markup.button.callback(`${globalIdx}`, `gtl:member:${m.userId}`);
  });

  const navButtons: any[] = [];
  const row: any[] = [];

  if (page > 0) {
    row.push(Markup.button.callback('⬅️ Önceki', `gtl:mpage:${page - 1}`));
  }
  if (page < totalPages - 1) {
    row.push(Markup.button.callback('Sonraki ➡️', `gtl:mpage:${page + 1}`));
  }
  if (row.length > 0) navButtons.push(row);

  navButtons.push([Markup.button.callback('❌ Kapat', 'gtl:close')]);

  const keyboard = Markup.inlineKeyboard(navButtons.length > 0 ? [...buttons.map((b) => [b]), ...navButtons] : [...buttons.map((b) => [b]), ...navButtons]);

  if (editMode) {
    return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  }
  return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
}

async function showMemberTasks(
  ctx: any,
  prisma: PrismaService,
  fromId: number,
  associationId: string,
  userId: string,
  page: number = 0,
  editMode: boolean = false,
) {
  const member = await prisma.associationMembership.findFirst({
    where: { associationId, userId, isActive: true, deletedAt: null },
    include: { user: { select: { fullName: true } } },
  });

  if (!member) return ctx.reply('❌ Üye bulunamadı.');

  const tasks = await prisma.task.findMany({
    where: { associationId, assignedToUserId: userId, deletedAt: null },
    orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  if (tasks.length === 0) {
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('↩️ Üye Seç', 'gtl:back-to-member')],
      [Markup.button.callback('❌ Kapat', 'gtl:close')],
    ]);

    if (editMode) {
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return ctx.reply(
        `📋 *${member.user.fullName}* - Görevleri\n\nHenüz atanmış görev yok.`,
        { parse_mode: 'Markdown', ...keyboard },
      );
    }
    return ctx.reply(
      `📋 *${member.user.fullName}* - Görevleri\n\nHenüz atanmış görev yok.`,
      { parse_mode: 'Markdown', ...keyboard },
    );
  }

  const totalPages = Math.ceil(tasks.length / TASKS_PER_PAGE);
  const startIdx = page * TASKS_PER_PAGE;
  const endIdx = Math.min(startIdx + TASKS_PER_PAGE, tasks.length);
  const pageTasks = tasks.slice(startIdx, endIdx);

  const grouped = new Map<string, typeof tasks>();
  for (const t of pageTasks) {
    const arr = grouped.get(t.status) ?? [];
    arr.push(t);
    grouped.set(t.status, arr);
  }

  let message = `📋 *${member.user.fullName}* - Görevleri\n`;
  message += `Toplam: *${tasks.length} görev* · Sayfa *${page + 1}/${totalPages}*\n\n`;

  const statusOrder = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  let globalNum = startIdx + 1;
  const numberedIds: string[] = [];

  for (const status of statusOrder) {
    const items = grouped.get(status);
    if (!items || items.length === 0) continue;

    const icon = STATUS_ICON[status] ?? '📌';
    const label = STATUS_LABEL[status] ?? status;
    message += `${icon} *${label}* (${items.length})\n`;

    for (const t of items) {
      const title = t.title.length > 40 ? t.title.slice(0, 40) + '…' : t.title;
      message += `  ${globalNum}. ${title}`;
      if (t.dueDate) {
        message += ` · 📅 ${fmtDate(t.dueDate.toISOString())}`;
      }
      message += '\n';
      numberedIds[globalNum] = t.id;
      globalNum++;
    }
    message += '\n';
  }

  message += `_İşlem için görev numarasını yaz (örn. ${startIdx + 1}). Tamamla / Ertele seçenekleri açılır._`;

  const s = taskSessions.get(fromId);
  if (s) {
    s.taskIds = numberedIds;
    s.listShownAt = Date.now();
    s.expiresAt = Date.now() + SESSION_TTL_MS;
  }

  const navButtons: any[] = [];
  const row: any[] = [];

  if (page > 0) {
    row.push(Markup.button.callback('⬅️ Önceki', `gtl:tasks:${page - 1}:${userId}`));
  }
  if (page < totalPages - 1) {
    row.push(Markup.button.callback('Sonraki ➡️', `gtl:tasks:${page + 1}:${userId}`));
  }
  if (row.length > 0) navButtons.push(row);

  navButtons.push([Markup.button.callback('↩️ Üye Seç', 'gtl:back-to-member')]);
  navButtons.push([Markup.button.callback('❌ Kapat', 'gtl:close')]);

  const keyboard = Markup.inlineKeyboard(navButtons);

  if (editMode) {
    return ctx.editMessageText(message, { parse_mode: 'Markdown', ...keyboard });
  }
  return ctx.reply(message, { parse_mode: 'Markdown', ...keyboard });
}
