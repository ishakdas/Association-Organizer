import { Telegraf, Markup, Context } from 'telegraf';
import { PrismaService, UserRole, PermissionAction } from '@ticketbot/database';
import { AiService } from '@ticketbot/ai';

const AI_DATE_MONTHS: Record<string, number> = {
  ocak: 0, şubat: 1, mart: 2, nisan: 3, mayıs: 4, haziran: 5,
  temmuz: 6, ağustos: 7, eylül: 8, ekim: 9, kasım: 10, aralık: 11,
};

function aiAddDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function aiAddMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function aiUtcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 17, 0, 0));
}

function parseTurkishDateText(text: string | null | undefined, ref: Date): Date | null {
  if (!text?.trim()) return null;

  const s = text.toLowerCase().trim();
  const refYear = ref.getUTCFullYear();
  const refMonth = ref.getUTCMonth();

  const dayMonthYear = s.match(/(\d{1,2})\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)(?:\s+(\d{4}))?/);
  if (dayMonthYear) {
    const day = parseInt(dayMonthYear[1], 10);
    const month = AI_DATE_MONTHS[dayMonthYear[2]];
    const year = dayMonthYear[3] ? parseInt(dayMonthYear[3], 10) : refYear;
    return aiUtcDate(year, month, day);
  }

  const monthStart = s.match(/(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)\s+başı?n?d?a?/);
  if (monthStart) {
    const month = AI_DATE_MONTHS[monthStart[1]];
    const year = month < refMonth ? refYear + 1 : refYear;
    return aiUtcDate(year, month, 1);
  }

  if (s.includes('ay son')) {
    return aiUtcDate(refYear, refMonth + 1, 0);
  }

  const weeksMatch = s.match(/(\d+)\s*hafta/);
  if (weeksMatch) {
    return aiAddDays(ref, parseInt(weeksMatch[1], 10) * 7);
  }

  if (s.includes('gelecek hafta') || s.includes('önümüzdeki hafta')) {
    return aiAddDays(ref, 7);
  }

  const monthsMatch = s.match(/(\d+)\s*ay/);
  if (monthsMatch) {
    return aiAddMonths(ref, parseInt(monthsMatch[1], 10));
  }

  return null;
}

type Step =
  | 'pickAssoc'
  | 'title'
  | 'date'
  | 'attendees'
  | 'content'
  | 'confirm'
  | 'aiPrompt'
  | 'aiReview'
  | 'aiAssign';

interface AssocOption {
  id: string;
  name: string;
}

interface MemberOption {
  userId: string;
  fullName: string;
}

interface AIActionItem {
  index: number;
  title: string;
  description: string | null;
  assignedToUserId: string | null;
  dueDate: Date | null;
  removed: boolean;
}

interface MeetingWizardSession {
  userId: string;
  step: Step;
  assocOptions?: AssocOption[];
  associationId?: string;
  associationName?: string;
  title?: string;
  meetingDate?: Date;
  members?: MemberOption[];
  selectedAttendees: Set<string>;
  content?: string;
  meetingId?: string;
  aiActionItems?: AIActionItem[];
  aiAssignTargetIndex?: number;
  expiresAt: number;
}

const sessions = new Map<number, MeetingWizardSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;

function evictExpired(now: number) {
  for (const [k, v] of sessions) {
    if (v.expiresAt <= now) sessions.delete(k);
  }
}

function touch(s: MeetingWizardSession) {
  s.expiresAt = Date.now() + SESSION_TTL_MS;
}

function fmtTrDate(d: Date): string {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}.${mm}.${yy}`;
}

function utcDate(year: number, month0: number, day: number): Date {
  return new Date(Date.UTC(year, month0, day, 12, 0, 0));
}

const TR_MONTHS: Record<string, number> = {
  ocak: 0, şubat: 1, subat: 1, mart: 2, nisan: 3,
  mayıs: 4, mayis: 4, haziran: 5, temmuz: 6,
  ağustos: 7, agustos: 7, eylül: 8, eylul: 8,
  ekim: 9, kasım: 10, kasim: 10, aralık: 11, aralik: 11,
};

function parseDateInput(raw: string): Date | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const d = now.getUTCDate();

  if (s === 'bugün' || s === 'bugun') return utcDate(y, m, d);
  if (s === 'yarın' || s === 'yarin') return utcDate(y, m, d + 1);
  if (s === 'dün' || s === 'dun') return utcDate(y, m, d - 1);

  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (dmy) {
    const dd = parseInt(dmy[1], 10);
    const mm = parseInt(dmy[2], 10);
    const yy = parseInt(dmy[3], 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return utcDate(yy, mm - 1, dd);
  }

  const dm = s.match(/^(\d{1,2})[./-](\d{1,2})$/);
  if (dm) {
    const dd = parseInt(dm[1], 10);
    const mm = parseInt(dm[2], 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return utcDate(y, mm - 1, dd);
  }

  const trDate = s.match(
    /^(\d{1,2})\s+([a-zçğıöşü]+)(?:\s+(\d{4}))?$/,
  );
  if (trDate) {
    const dd = parseInt(trDate[1], 10);
    const mm = TR_MONTHS[trDate[2]];
    if (mm === undefined || dd < 1 || dd > 31) return null;
    const yy = trDate[3] ? parseInt(trDate[3], 10) : y;
    return utcDate(yy, mm, dd);
  }

  return null;
}

const CANCEL_HINT = '\n\nİptal etmek için /iptal yazabilirsin.';

async function assertMeetingAccess(
  prisma: PrismaService,
  userId: string,
  associationId: string,
): Promise<boolean> {
  const membership = await prisma.associationMembership.findFirst({
    where: {
      userId,
      associationId,
      isActive: true,
      deletedAt: null,
      role: {
        in: [
          UserRole.SYSTEM_ADMIN,
          UserRole.ASSOCIATION_MANAGER,
          UserRole.ASSOCIATION_SECRETARY,
        ],
      },
    },
  });
  if (membership) return true;

  const permission = await prisma.permission.findFirst({
    where: {
      associationId,
      userId,
      action: PermissionAction.USE_MEETING_COMMANDS,
    },
  });
  return !!permission;
}

async function assertAccountStillLinked(
  prisma: PrismaService,
  telegramId: number,
): Promise<boolean> {
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: BigInt(telegramId) },
    select: { id: true },
  });
  return !!account;
}

async function loadEligibleAssociations(
  prisma: PrismaService,
  userId: string,
): Promise<AssocOption[]> {
  const memberships = await prisma.associationMembership.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
      association: { deletedAt: null },
    },
    select: {
      association: { select: { id: true, name: true } },
    },
    orderBy: { association: { name: 'asc' } },
  });

  const seen = new Set<string>();
  const out: AssocOption[] = [];
  for (const m of memberships) {
    const assoc = m.association;
    if (seen.has(assoc.id)) continue;
    seen.add(assoc.id);

    const hasAccess = await assertMeetingAccess(prisma, userId, assoc.id);
    if (hasAccess) {
      out.push({ id: assoc.id, name: assoc.name });
    }
  }
  return out;
}

async function loadActiveMembers(
  prisma: PrismaService,
  associationId: string,
): Promise<MemberOption[]> {
  const rows = await prisma.associationMembership.findMany({
    where: { associationId, isActive: true, deletedAt: null },
    select: {
      user: { select: { id: true, fullName: true } },
    },
    orderBy: { user: { fullName: 'asc' } },
  });
  const seen = new Set<string>();
  const out: MemberOption[] = [];
  for (const r of rows) {
    if (seen.has(r.user.id)) continue;
    seen.add(r.user.id);
    out.push({ userId: r.user.id, fullName: r.user.fullName });
  }
  return out;
}

function attendeesKeyboard(s: MeetingWizardSession) {
  const rows = (s.members ?? []).map((m) => {
    const checked = s.selectedAttendees.has(m.userId);
    return [
      Markup.button.callback(
        `${checked ? '☑' : '☐'} ${m.fullName}`,
        `mtg:att:${m.userId}`,
      ),
    ];
  });
  rows.push([
    Markup.button.callback('🔁 Tümünü seç', 'mtg:att-all'),
    Markup.button.callback('🧹 Temizle', 'mtg:att-clear'),
  ]);
  rows.push([
    Markup.button.callback('✅ Bitti', 'mtg:att-done'),
    Markup.button.callback('❌ Vazgeç', 'mtg:cancel'),
  ]);
  return Markup.inlineKeyboard(rows);
}

function buildAIReviewKeyboard(s: MeetingWizardSession) {
  const items = s.aiActionItems ?? [];
  const rows: any[][] = [];

  for (const item of items) {
    if (item.removed) continue;
    const member = (s.members ?? []).find((m) => m.userId === item.assignedToUserId);
    const assigneeLabel = member ? member.fullName : 'Atanmamış';
    rows.push([
      Markup.button.callback(
        `👤 ${assigneeLabel}`,
        `mtg:ai-assign:${item.index}`,
      ),
      Markup.button.callback(
        '🗑',
        `mtg:ai-remove:${item.index}`,
      ),
    ]);
  }

  const removedCount = items.filter((i) => i.removed).length;
  if (removedCount > 0) {
    rows.push([
      Markup.button.callback(
        `↩️ Kaldırılanları geri getir (${removedCount})`,
        'mtg:ai-restore-all',
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('✅ Tümünü Kaydet', 'mtg:ai-save'),
    Markup.button.callback('❌ İptal', 'mtg:ai-cancel'),
  ]);

  return Markup.inlineKeyboard(rows);
}

function buildAIAssignKeyboard(s: MeetingWizardSession) {
  const members = s.members ?? [];
  const targetIndex = s.aiAssignTargetIndex!;
  const item = (s.aiActionItems ?? []).find((i) => i.index === targetIndex);

  const rows: any[][] = [];
  for (const member of members) {
    const isCurrent = item?.assignedToUserId === member.userId;
    rows.push([
      Markup.button.callback(
        `${isCurrent ? '● ' : ''}${member.fullName}`,
        `mtg:ai-assign-set:${targetIndex}:${member.userId}`,
      ),
    ]);
  }

  rows.push([
    Markup.button.callback('🔘 Atamasız bırak', `mtg:ai-assign-set:${targetIndex}:null`),
  ]);
  rows.push([
    Markup.button.callback('↩️ Geri dön', 'mtg:ai-assign-back'),
  ]);

  return Markup.inlineKeyboard(rows);
}

async function startWizard(
  ctx: Context,
  prisma: PrismaService,
  telegramUserId: number,
) {
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: BigInt(telegramUserId) },
    select: { userId: true },
  });
  if (!account) {
    return ctx.reply(
      'Önce hesabını bağlamalısın. Web panelinden bağlantı kodu al ve ' +
        '/link <kod> komutuyla bağla.',
    );
  }

  const assocs = await loadEligibleAssociations(prisma, account.userId);
  if (assocs.length === 0) {
    const hasAnyMembership = await prisma.associationMembership.findFirst({
      where: {
        userId: account.userId,
        isActive: true,
        deletedAt: null,
        association: { deletedAt: null },
      },
    });
    if (hasAnyMembership) {
      return ctx.reply(
        '📝 Toplantı işlemleri için yetkiniz bulunmamaktadır. Sadece başkan, ' +
          'sekreter veya toplantı yetkisi verilmiş kullanıcılar toplantı ' +
          'notu ekleyebilir.',
      );
    }
    return ctx.reply('Aktif bir dernek üyeliğin bulunamadı.');
  }

  if (assocs.length === 1) {
    const a = assocs[0];
    const session: MeetingWizardSession = {
      userId: account.userId,
      step: 'title',
      associationId: a.id,
      associationName: a.name,
      selectedAttendees: new Set(),
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(telegramUserId, session);
    return ctx.reply(
      `📝 Yeni toplantı notu — ${a.name}\n\n` +
        '1/4 · Toplantının *başlığını* gönder.' +
        CANCEL_HINT,
      { parse_mode: 'Markdown' },
    );
  }

  const session: MeetingWizardSession = {
    userId: account.userId,
    step: 'pickAssoc',
    assocOptions: assocs,
    selectedAttendees: new Set(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(telegramUserId, session);

  const buttons = assocs.map((a) => [
    Markup.button.callback(a.name, `mtg:assoc:${a.id}`),
  ]);
  buttons.push([Markup.button.callback('❌ Vazgeç', 'mtg:cancel')]);
  return ctx.reply(
    '📝 Yeni toplantı notu\n\nHangi dernek için ekleyeceksin?',
    Markup.inlineKeyboard(buttons),
  );
}

async function persistMeeting(
  prisma: PrismaService,
  s: MeetingWizardSession,
) {
  const attendeeIds = Array.from(s.selectedAttendees);
  return prisma.meetingNote.create({
    data: {
      associationId: s.associationId!,
      title: s.title!,
      content: s.content!,
      meetingDate: s.meetingDate!,
      createdById: s.userId,
      attendees: { create: attendeeIds.map((userId) => ({ userId })) },
    },
    select: { id: true, title: true, meetingDate: true },
  });
}

async function persistAITasks(
  prisma: PrismaService,
  s: MeetingWizardSession,
) {
  const items = (s.aiActionItems ?? []).filter((i) => !i.removed);
  const tasksToCreate = items
    .filter((i) => i.assignedToUserId !== null)
    .map((i) => ({
      title: i.title,
      description: i.description ?? '',
      associationId: s.associationId!,
      assignedToUserId: i.assignedToUserId!,
      assignedById: s.userId,
      dueDate: i.dueDate,
      priority: 'MEDIUM' as const,
      status: 'PENDING' as const,
      sourceMeetingNoteId: s.meetingId!,
    }));

  if (tasksToCreate.length === 0) return 0;

  await prisma.task.createMany({ data: tasksToCreate });
  return tasksToCreate.length;
}

export function registerMeetingWizard(
  bot: Telegraf,
  prisma: PrismaService,
  aiService: AiService,
) {
  console.log('[WIZARD] registerMeetingWizard called - AI flow enabled');
  bot.hears(/^\/toplant[ıi](?:@\w+)?(?:\s|$)/i, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    try {
      return await startWizard(ctx, prisma, fromId);
    } catch (err) {
      return ctx.reply('Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.');
    }
  });

  bot.command('iptal', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    if (sessions.delete(fromId)) {
      return ctx.reply('Toplantı ekleme iptal edildi.');
    }
    return ctx.reply('Aktif bir toplantı ekleme akışın yok.');
  });

  bot.on('text', async (ctx, next) => {
    const fromId = ctx.from?.id;
    const text = ctx.message?.text;
    if (!fromId || !text || text.startsWith('/')) return next();

    const s = sessions.get(fromId);
    if (!s) return next();

    if (s.expiresAt <= Date.now()) {
      sessions.delete(fromId);
      return ctx.reply(
        'Toplantı ekleme oturumun zaman aşımına uğradı. Tekrar /toplanti yaz.',
      );
    }

    if (s.userId) {
      const stillLinked = await assertAccountStillLinked(prisma, fromId);
      if (!stillLinked) {
        sessions.delete(fromId);
        return ctx.reply(
          'Telegram hesabın artık sistemde bağlı değil. ' +
            'Web panelinden yeniden bağlamalısın.',
        );
      }
    }

    if (s.step === 'title') {
      const title = text.trim();
      if (title.length < 2 || title.length > 255) {
        return ctx.reply('Başlık 2–255 karakter olmalı. Tekrar gönder.');
      }
      s.title = title;
      s.step = 'date';
      touch(s);
      return ctx.reply(
        '2/4 · Toplantı *tarihini* gönder.\n\n' +
          'Örnekler:\n' +
          '• bugün / yarın / dün\n' +
          '• 15.05.2026\n' +
          '• 15.05 (bu yıl)\n' +
          '• 15 mayıs 2026',
        { parse_mode: 'Markdown' },
      );
    }

    if (s.step === 'date') {
      const parsed = parseDateInput(text);
      if (!parsed) {
        return ctx.reply(
          'Tarihi anlayamadım. Örnek: 15.05.2026, bugün, 15 mayıs.',
        );
      }
      s.meetingDate = parsed;

      const members = await loadActiveMembers(prisma, s.associationId!);
      if (members.length === 0) {
        sessions.delete(fromId);
        return ctx.reply(
          'Bu derneğin aktif üyesi yok, toplantıya katılımcı eklenemez. ' +
            'Akış iptal edildi.',
        );
      }
      s.members = members;
      s.step = 'attendees';
      touch(s);
      return ctx.reply(
        `Tarih: ${fmtTrDate(parsed)}\n\n` +
          '3/4 · *Katılımcıları* seç. Bittiğinde "✅ Bitti"ye dokun.',
        { parse_mode: 'Markdown', ...attendeesKeyboard(s) },
      );
    }

    if (s.step === 'content') {
      const content = text.trim();
      if (content.length < 1 || content.length > 50000) {
        return ctx.reply('İçerik 1–50000 karakter olmalı. Tekrar gönder.');
      }
      s.content = content;
      s.step = 'confirm';
      touch(s);

      const attendeeNames =
        (s.members ?? [])
          .filter((m) => s.selectedAttendees.has(m.userId))
          .map((m) => `• ${m.fullName}`)
          .join('\n') || '—';

      return ctx.reply(
        '4/4 · Özet\n\n' +
          `Dernek: ${s.associationName ?? '-'}\n` +
          `Başlık: ${s.title}\n` +
          `Tarih: ${fmtTrDate(s.meetingDate!)}\n` +
          `Katılımcılar (${s.selectedAttendees.size}):\n${attendeeNames}\n\n` +
          'Onaylıyor musun?',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Onayla', 'mtg:confirm'),
            Markup.button.callback('❌ Vazgeç', 'mtg:cancel'),
          ],
        ]),
      );
    }

    if (s.step === 'attendees') {
      return ctx.reply(
        'Katılımcı seçimi inline butonlar üzerinden yapılır. Listedeki ' +
          'isimlere dokun, bittiğinde "✅ Bitti"ye bas.',
      );
    }

    if (s.step === 'pickAssoc') {
      return ctx.reply('Önce yukarıdaki listeden bir dernek seç.');
    }

    if (s.step === 'aiPrompt' || s.step === 'aiReview' || s.step === 'aiAssign') {
      return ctx.reply(
        'Lütfen aşağıdaki butonları kullan. Metin girişi bu adımda kullanılmaz.',
      );
    }
  });

  bot.action('mtg:cancel', async (ctx) => {
    const fromId = ctx.from?.id;
    if (fromId) sessions.delete(fromId);
    await ctx.answerCbQuery('İptal edildi');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply('Toplantı ekleme iptal edildi.');
  });

  bot.action(/^mtg:assoc:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickAssoc') {
      return ctx.answerCbQuery('Akış güncel değil');
    }
    const assocId = ctx.match[1];
    const picked = (s.assocOptions ?? []).find((a) => a.id === assocId);
    if (!picked) return ctx.answerCbQuery('Geçersiz seçim');

    s.associationId = picked.id;
    s.associationName = picked.name;
    s.step = 'title';
    touch(s);

    await ctx.answerCbQuery(picked.name);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      `📝 ${picked.name}\n\n1/4 · Toplantının *başlığını* gönder.` +
        CANCEL_HINT,
      { parse_mode: 'Markdown' },
    );
  });

  bot.action(/^mtg:att:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'attendees') {
      return ctx.answerCbQuery('Akış güncel değil');
    }
    const userId = ctx.match[1];
    if (!(s.members ?? []).some((m) => m.userId === userId)) {
      return ctx.answerCbQuery('Geçersiz üye');
    }
    if (s.selectedAttendees.has(userId)) s.selectedAttendees.delete(userId);
    else s.selectedAttendees.add(userId);
    touch(s);
    await ctx.answerCbQuery();
    return ctx
      .editMessageReplyMarkup(attendeesKeyboard(s).reply_markup)
      .catch(() => undefined);
  });

  bot.action('mtg:att-all', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'attendees') {
      return ctx.answerCbQuery('Akış güncel değil');
    }
    for (const m of s.members ?? []) s.selectedAttendees.add(m.userId);
    touch(s);
    await ctx.answerCbQuery('Hepsi seçildi');
    return ctx
      .editMessageReplyMarkup(attendeesKeyboard(s).reply_markup)
      .catch(() => undefined);
  });

  bot.action('mtg:att-clear', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'attendees') {
      return ctx.answerCbQuery('Akış güncel değil');
    }
    s.selectedAttendees.clear();
    touch(s);
    await ctx.answerCbQuery('Temizlendi');
    return ctx
      .editMessageReplyMarkup(attendeesKeyboard(s).reply_markup)
      .catch(() => undefined);
  });

  bot.action('mtg:att-done', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'attendees') {
      return ctx.answerCbQuery('Akış güncel değil');
    }
    if (s.selectedAttendees.size === 0) {
      return ctx.answerCbQuery('En az bir katılımcı seçmelisin');
    }
    s.step = 'content';
    touch(s);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      '4/4 · Toplantının *içeriğini / notlarını* gönder.' + CANCEL_HINT,
      { parse_mode: 'Markdown' },
    );
  });

  bot.action('mtg:confirm', async (ctx) => {
    console.log('[WIZARD] mtg:confirm callback triggered');
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    console.log('[WIZARD] mtg:confirm - session:', s ? `found, step=${s.step}` : 'NOT FOUND');
    if (!s || s.step !== 'confirm') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    const stillLinked = await assertAccountStillLinked(prisma, fromId);
    if (!stillLinked) {
      sessions.delete(fromId);
      return ctx.answerCbQuery(
        'Telegram hesabın artık sistemde bağlı değil. Web panelinden yeniden bağlamalısın.',
        { show_alert: true },
      );
    }

    await ctx.answerCbQuery('Kaydediliyor…');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    try {
      console.log('[WIZARD] mtg:confirm - persisting meeting, userId:', s.userId);
      const created = await persistMeeting(prisma, s);
      console.log('[WIZARD] mtg:confirm - meeting created:', created.id);
      s.meetingId = created.id;
      s.step = 'aiPrompt';
      touch(s);
      console.log('[WIZARD] mtg:confirm - step changed to aiPrompt, sending reply...');

      const replyMsg = await ctx.reply(
        `✅ Toplantı notu kaydedildi.\n\n` +
          `Başlık: ${created.title}\n` +
          `Tarih: ${fmtTrDate(created.meetingDate)}\n\n` +
          '🤖 Yapay zeka ile toplantı notundan görev ve aksiyonlar ' +
          'çıkarmamı ister misin?\n\n' +
          'Görevleri inceleyip atamaları değiştirebilirsin.',
        Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Görevleri Çıkar', 'mtg:ai-analyze'),
            Markup.button.callback('❌ Şimdilik Hayır', 'mtg:ai-skip'),
          ],
        ]),
      );
      console.log('[WIZARD] mtg:confirm - reply sent, messageId:', replyMsg.message_id);
      console.log('[WIZARD] mtg:confirm - reply text:', replyMsg.text?.slice(0, 100));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WIZARD] mtg:confirm - error:', msg);
      sessions.delete(fromId);
      return ctx.reply(
        `❌ Kaydedilemedi: ${msg}\n\nTekrar denemek için /toplanti yaz.`,
      );
    }
  });

  bot.action('mtg:ai-skip', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiPrompt') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    sessions.delete(fromId);
    await ctx.answerCbQuery('Tamam');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      'Toplantı notu kaydedildi. Yapay zeka analizi atlandı.\n\n' +
        'Dilersen web panelinden daha sonra analiz yapabilirsin.',
    );
  });

  bot.action('mtg:ai-analyze', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiPrompt') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    console.log('[WIZARD] mtg:ai-analyze - starting AI analysis, userId:', s.userId);
    await ctx.answerCbQuery('Analiz yapılıyor…');

    try {
      const members = s.members ?? [];
      const membersContext = members
        .map((m) => `- ${m.fullName} (userId: ${m.userId})`)
        .join('\n');

      console.log('[WIZARD] mtg:ai-analyze - calling aiService.extractActionItems');
      console.log('[WIZARD] mtg:ai-analyze - content length:', s.content!.length);
      console.log('[WIZARD] mtg:ai-analyze - members count:', members.length);

      const result = await aiService.extractActionItems(
        s.content!,
        membersContext,
      );

      console.log('[WIZARD] mtg:ai-analyze - AI result:', JSON.stringify(result).slice(0, 500));

      const now = new Date();
      const aiItems: AIActionItem[] = result.actionItems.map((item, index) => {
        const dueDate = item.dueDateText
          ? parseTurkishDateText(item.dueDateText, now)
          : null;
        return {
          index,
          title: item.title,
          description: item.description,
          assignedToUserId: item.assignedToUserId,
          dueDate,
          removed: false,
        };
      });

      s.aiActionItems = aiItems;
      s.step = 'aiReview';
      touch(s);

      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

      const activeItems = aiItems.filter((i) => !i.removed);
      const assignedCount = activeItems.filter((i) => i.assignedToUserId).length;
      const unassignedCount = activeItems.length - assignedCount;

      let message = `🤖 Yapay Zeka Analizi Sonuçları\n\n`;
      message += `Toplantı notundan *${activeItems.length} görev* çıkarıldı.\n`;
      message += `✅ ${assignedCount} atanmış`;
      if (unassignedCount > 0) {
        message += ` · ⚠️ ${unassignedCount} atanmamış`;
      }
      message += '\n\n';

      for (const item of activeItems) {
        const num = item.index + 1;
        const member = members.find((m) => m.userId === item.assignedToUserId);
        const assigneeName = member ? member.fullName : 'Atanmamış';
        const warnIcon = item.assignedToUserId ? '' : '⚠️ ';

        message += `${num}️⃣ ${item.title}\n`;
        if (item.description) {
          message += `   ${item.description.slice(0, 100)}${item.description.length > 100 ? '...' : ''}\n`;
        }
        message += `   📅 ${warnIcon}${assigneeName}`;
        if (item.dueDate) {
          message += ` · ${fmtTrDate(item.dueDate)}`;
        }
        message += '\n\n';
      }

      message += 'Her görev için 👤 butonuna basarak atamayı değiştirebilirsin.';

      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...buildAIReviewKeyboard(s),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[WIZARD] mtg:ai-analyze - error:', msg);
      console.error('[WIZARD] mtg:ai-analyze - error stack:', err instanceof Error ? err.stack : 'N/A');
      console.error('[WIZARD] mtg:ai-analyze - error type:', err?.constructor?.name ?? 'unknown');
      sessions.delete(fromId);
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return ctx.reply(
        `❌ Yapay zeka analizi başarısız: ${msg}\n\n` +
          'Toplantı notun kaydedildi, web panelinden tekrar deneyebilirsin.\n\n' +
          `Hata detayı: ${err?.constructor?.name ?? 'unknown'}`,
      );
    }
  });

  bot.action(/^mtg:ai-assign:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiReview') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    const itemIndex = parseInt(ctx.match[1], 10);
    const item = (s.aiActionItems ?? []).find((i) => i.index === itemIndex);
    if (!item || item.removed) {
      return ctx.answerCbQuery('Geçersiz görev');
    }

    s.aiAssignTargetIndex = itemIndex;
    s.step = 'aiAssign';
    touch(s);

    const member = (s.members ?? []).find((m) => m.userId === item.assignedToUserId);
    const currentName = member ? member.fullName : 'Atanmamış';

    await ctx.answerCbQuery(`${item.title} — Atama: ${currentName}`);
    return ctx.reply(
      `📋 Görev: *${item.title}*\n\nAtamayı değiştirmek için bir kullanıcı seç:`,
      {
        parse_mode: 'Markdown',
        ...buildAIAssignKeyboard(s),
      },
    );
  });

  bot.action(/^mtg:ai-assign-set:(\d+):(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiAssign') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    const itemIndex = parseInt(ctx.match[1], 10);
    const userIdStr = ctx.match[2];
    const newUserId = userIdStr === 'null' ? null : userIdStr;

    const item = (s.aiActionItems ?? []).find((i) => i.index === itemIndex);
    if (!item) {
      return ctx.answerCbQuery('Geçersiz görev');
    }

    item.assignedToUserId = newUserId;
    s.step = 'aiReview';
    s.aiAssignTargetIndex = undefined;
    touch(s);

    const member = (s.members ?? []).find((m) => m.userId === newUserId);
    const newName = member ? member.fullName : 'Atanmamış';
    await ctx.answerCbQuery(`Atama güncellendi: ${newName}`);

    const activeItems = (s.aiActionItems ?? []).filter((i) => !i.removed);
    const assignedCount = activeItems.filter((i) => i.assignedToUserId).length;
    const unassignedCount = activeItems.length - assignedCount;

    let message = `🤖 Yapay Zeka Analizi Sonuçları\n\n`;
    message += `Toplantı notundan *${activeItems.length} görev* çıkarıldı.\n`;
    message += `✅ ${assignedCount} atanmış`;
    if (unassignedCount > 0) {
      message += ` · ⚠️ ${unassignedCount} atanmamış`;
    }
    message += '\n\n';

    for (const it of activeItems) {
      const num = it.index + 1;
      const m = (s.members ?? []).find((mm) => mm.userId === it.assignedToUserId);
      const assigneeName = m ? m.fullName : 'Atanmamış';
      const warnIcon = it.assignedToUserId ? '' : '⚠️ ';

      message += `${num}️⃣ ${it.title}\n`;
      if (it.description) {
        message += `   ${it.description.slice(0, 100)}${it.description.length > 100 ? '...' : ''}\n`;
      }
      message += `   📅 ${warnIcon}${assigneeName}`;
      if (it.dueDate) {
        message += ` · ${fmtTrDate(it.dueDate)}`;
      }
      message += '\n\n';
    }

    message += 'Her görev için 👤 butonuna basarak atamayı değiştirebilirsin.';

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...buildAIReviewKeyboard(s),
    });
  });

  bot.action('mtg:ai-assign-back', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiAssign') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    s.step = 'aiReview';
    s.aiAssignTargetIndex = undefined;
    touch(s);

    await ctx.answerCbQuery('Geri dönüldü');

    const activeItems = (s.aiActionItems ?? []).filter((i) => !i.removed);
    const assignedCount = activeItems.filter((i) => i.assignedToUserId).length;
    const unassignedCount = activeItems.length - assignedCount;

    let message = `🤖 Yapay Zeka Analizi Sonuçları\n\n`;
    message += `Toplantı notundan *${activeItems.length} görev* çıkarıldı.\n`;
    message += `✅ ${assignedCount} atanmış`;
    if (unassignedCount > 0) {
      message += ` · ⚠️ ${unassignedCount} atanmamış`;
    }
    message += '\n\n';

    for (const item of activeItems) {
      const num = item.index + 1;
      const member = (s.members ?? []).find((m) => m.userId === item.assignedToUserId);
      const assigneeName = member ? member.fullName : 'Atanmamış';
      const warnIcon = item.assignedToUserId ? '' : '⚠️ ';

      message += `${num}️⃣ ${item.title}\n`;
      if (item.description) {
        message += `   ${item.description.slice(0, 100)}${item.description.length > 100 ? '...' : ''}\n`;
      }
      message += `   📅 ${warnIcon}${assigneeName}`;
      if (item.dueDate) {
        message += ` · ${fmtTrDate(item.dueDate)}`;
      }
      message += '\n\n';
    }

    message += 'Her görev için 👤 butonuna basarak atamayı değiştirebilirsin.';

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...buildAIReviewKeyboard(s),
    });
  });

  bot.action(/^mtg:ai-remove:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiReview') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    const itemIndex = parseInt(ctx.match[1], 10);
    const item = (s.aiActionItems ?? []).find((i) => i.index === itemIndex);
    if (!item || item.removed) {
      return ctx.answerCbQuery('Geçersiz görev');
    }

    item.removed = true;
    touch(s);

    await ctx.answerCbQuery('Görev listeden kaldırıldı');

    const activeItems = (s.aiActionItems ?? []).filter((i) => !i.removed);
    if (activeItems.length === 0) {
      sessions.delete(fromId);
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return ctx.reply(
        'Tüm görevler kaldırıldı. Toplantı notu kaydedildi, görev oluşturulmadı.',
      );
    }

    const assignedCount = activeItems.filter((i) => i.assignedToUserId).length;
    const unassignedCount = activeItems.length - assignedCount;

    let message = `🤖 Yapay Zeka Analizi Sonuçları\n\n`;
    message += `Toplantı notundan *${activeItems.length} görev* çıkarıldı.\n`;
    message += `✅ ${assignedCount} atanmış`;
    if (unassignedCount > 0) {
      message += ` · ⚠️ ${unassignedCount} atanmamış`;
    }
    message += '\n\n';

    for (const it of activeItems) {
      const num = it.index + 1;
      const m = (s.members ?? []).find((mm) => mm.userId === it.assignedToUserId);
      const assigneeName = m ? m.fullName : 'Atanmamış';
      const warnIcon = it.assignedToUserId ? '' : '⚠️ ';

      message += `${num}️⃣ ${it.title}\n`;
      if (it.description) {
        message += `   ${it.description.slice(0, 100)}${it.description.length > 100 ? '...' : ''}\n`;
      }
      message += `   📅 ${warnIcon}${assigneeName}`;
      if (it.dueDate) {
        message += ` · ${fmtTrDate(it.dueDate)}`;
      }
      message += '\n\n';
    }

    message += 'Her görev için 👤 butonuna basarak atamayı değiştirebilirsin.';

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...buildAIReviewKeyboard(s),
    });
  });

  bot.action('mtg:ai-restore-all', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiReview') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    let restored = 0;
    for (const item of s.aiActionItems ?? []) {
      if (item.removed) {
        item.removed = false;
        restored++;
      }
    }
    touch(s);

    await ctx.answerCbQuery(`${restored} görev geri getirildi`);

    const activeItems = (s.aiActionItems ?? []).filter((i) => !i.removed);
    const assignedCount = activeItems.filter((i) => i.assignedToUserId).length;
    const unassignedCount = activeItems.length - assignedCount;

    let message = `🤖 Yapay Zeka Analizi Sonuçları\n\n`;
    message += `Toplantı notundan *${activeItems.length} görev* çıkarıldı.\n`;
    message += `✅ ${assignedCount} atanmış`;
    if (unassignedCount > 0) {
      message += ` · ⚠️ ${unassignedCount} atanmamış`;
    }
    message += '\n\n';

    for (const item of activeItems) {
      const num = item.index + 1;
      const member = (s.members ?? []).find((m) => m.userId === item.assignedToUserId);
      const assigneeName = member ? member.fullName : 'Atanmamış';
      const warnIcon = item.assignedToUserId ? '' : '⚠️ ';

      message += `${num}️⃣ ${item.title}\n`;
      if (item.description) {
        message += `   ${item.description.slice(0, 100)}${item.description.length > 100 ? '...' : ''}\n`;
      }
      message += `   📅 ${warnIcon}${assigneeName}`;
      if (item.dueDate) {
        message += ` · ${fmtTrDate(item.dueDate)}`;
      }
      message += '\n\n';
    }

    message += 'Her görev için 👤 butonuna basarak atamayı değiştirebilirsin.';

    return ctx.reply(message, {
      parse_mode: 'Markdown',
      ...buildAIReviewKeyboard(s),
    });
  });

  bot.action('mtg:ai-save', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'aiReview') {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    await ctx.answerCbQuery('Görevler kaydediliyor…');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    try {
      const count = await persistAITasks(prisma, s);
      sessions.delete(fromId);

      const activeItems = (s.aiActionItems ?? []).filter((i) => !i.removed);
      const assignedCount = activeItems.filter((i) => i.assignedToUserId).length;

      return ctx.reply(
        `✅ ${count} görev başarıyla oluşturuldu.\n\n` +
          `${assignedCount} kişiye atandı, ${activeItems.length - assignedCount} atanmadı (web panelinden atayabilirsin).`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      sessions.delete(fromId);
      return ctx.reply(
        `❌ Görevler kaydedilemedi: ${msg}\n\n` +
          'Toplantı notun kaydedildi, web panelinden görev oluşturabilirsin.',
      );
    }
  });

  bot.action('mtg:ai-cancel', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || (s.step !== 'aiReview' && s.step !== 'aiAssign' && s.step !== 'aiPrompt')) {
      return ctx.answerCbQuery('Akış güncel değil');
    }

    sessions.delete(fromId);
    await ctx.answerCbQuery('İptal edildi');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      'Yapay zeka analizi iptal edildi. Toplantı notun kaydedildi.',
    );
  });
}
