import { Telegraf, Markup, Context } from 'telegraf';
import { PrismaService, UserRole } from '@ticketbot/database';

type Step =
  | 'pickAssoc'
  | 'title'
  | 'date'
  | 'attendees'
  | 'content'
  | 'confirm';

interface AssocOption {
  id: string;
  name: string;
}

interface MemberOption {
  userId: string;
  fullName: string;
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
  expiresAt: number;
}

// In-memory only: bot runs inside the API process, sessions are short-lived,
// and a wizard mid-flight on a process restart should just be re-started.
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
  // Anchor to noon UTC so the displayed local date is stable across TZs.
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

  const dmy = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (dmy) {
    const dd = parseInt(dmy[1], 10);
    const mm = parseInt(dmy[2], 10);
    const yy = parseInt(dmy[3], 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    return utcDate(yy, mm - 1, dd);
  }

  const dm = s.match(/^(\d{1,2})[.\/-](\d{1,2})$/);
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

async function loadEligibleAssociations(
  prisma: PrismaService,
  userId: string,
): Promise<AssocOption[]> {
  const memberships = await prisma.associationMembership.findMany({
    where: {
      userId,
      isActive: true,
      deletedAt: null,
      role: {
        in: [
          UserRole.SYSTEM_ADMIN,
          UserRole.ASSOCIATION_MANAGER,
          UserRole.ASSOCIATION_SECRETARY,
        ],
      },
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
    if (seen.has(m.association.id)) continue;
    seen.add(m.association.id);
    out.push({ id: m.association.id, name: m.association.name });
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
    return ctx.reply(
      'Toplantı notu eklemek için Başkan veya Sekreter rolünde aktif bir ' +
        'üyeliğin olmalı. Yetkili olduğun bir dernek bulunamadı.',
    );
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

export function registerMeetingWizard(bot: Telegraf, prisma: PrismaService) {
  // /toplanti or /toplantı (Turkish 'ı' support via regex hears).
  bot.hears(/^\/toplant[ıi](?:@\w+)?(?:\s|$)/i, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    return startWizard(ctx, prisma, fromId);
  });

  bot.command('iptal', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    if (sessions.delete(fromId)) {
      return ctx.reply('Toplantı ekleme iptal edildi.');
    }
    return ctx.reply('Aktif bir toplantı ekleme akışın yok.');
  });

  // Free-text input for title / date / content steps.
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
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'confirm') {
      return ctx.answerCbQuery('Akış güncel değil');
    }
    await ctx.answerCbQuery('Kaydediliyor…');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    try {
      const created = await persistMeeting(prisma, s);
      sessions.delete(fromId);
      return ctx.reply(
        `✅ Toplantı notu kaydedildi.\n\n` +
          `Başlık: ${created.title}\n` +
          `Tarih: ${fmtTrDate(created.meetingDate)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return ctx.reply(
        `❌ Kaydedilemedi: ${msg}\n\nTekrar denemek için /toplanti yaz.`,
      );
    }
  });
}
