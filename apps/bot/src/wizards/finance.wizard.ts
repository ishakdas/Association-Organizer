import { Telegraf, Markup, Context } from 'telegraf';
import {
  PrismaService,
  UserRole,
  TransactionType,
} from '@ticketbot/database';

type FinanceStep =
  | 'pickAssoc'
  | 'pickType'
  | 'pickCategory'
  | 'pickMember'
  | 'pickMonth'
  | 'amount'
  | 'description'
  | 'pickDate'
  | 'confirm'
  | 'idle';

type FinanceAction = 'expense' | 'donation' | 'fee' | 'summary' | 'history' | 'stats';

interface FinanceWizardSession {
  userId: string;
  step: FinanceStep;
  action?: FinanceAction;
  associationId?: string;
  associationName?: string;
  assocOptions?: Array<{ id: string; name: string }>;
  categoryId?: string;
  categoryName?: string;
  membershipId?: string;
  membershipName?: string;
  memberOptions?: Array<{ id: string; name: string }>;
  month?: string;
  amountInKurus?: number;
  description?: string;
  transactionDate?: string; // ISO date (YYYY-MM-DD)
  confirmNegative?: boolean;
  expiresAt: number;
}

const sessions = new Map<number, FinanceWizardSession>();
const SESSION_TTL_MS = 10 * 60 * 1000;
const HISTORY_PAGE_SIZE = 8;

function evictExpired(now: number) {
  for (const [k, v] of sessions) {
    if (v.expiresAt <= now) sessions.delete(k);
  }
}

function touch(s: FinanceWizardSession) {
  s.expiresAt = Date.now() + SESSION_TTL_MS;
}

function kurusToTl(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return new Date().toLocaleDateString('tr-TR');
  const d = new Date(dateStr);
  return d.toLocaleDateString('tr-TR');
}

async function getCurrentBalance(
  prisma: PrismaService,
  associationId: string,
): Promise<number> {
  const [incomeAgg, expenseAgg] = await prisma.$transaction([
    prisma.transaction.aggregate({
      where: { associationId, type: 'INCOME', deletedAt: null },
      _sum: { amountInKurus: true },
    }),
    prisma.transaction.aggregate({
      where: { associationId, type: 'EXPENSE', deletedAt: null },
      _sum: { amountInKurus: true },
    }),
  ]);
  return (incomeAgg._sum.amountInKurus ?? 0) - (expenseAgg._sum.amountInKurus ?? 0);
}

function mainMenuButtons(): ReturnType<typeof Markup.button.callback>[][] {
  return [
    [Markup.button.callback('💸 Gider Ekle', 'fin:expense')],
    [Markup.button.callback('🎁 Bağış Kaydet', 'fin:donation')],
    [Markup.button.callback('📋 Aidat Al', 'fin:fee')],
    [Markup.button.callback('📜 İşlem Geçmişi', 'fin:history')],
    [Markup.button.callback('📊 Aylık Özet', 'fin:stats')],
    [Markup.button.callback('📈 Kasa Durumu', 'fin:summary')],
    [Markup.button.callback('❌ İptal', 'fin:cancel')],
  ];
}

async function showMainMenu(ctx: Context) {
  return ctx.reply(
    '💰 Finans Menüsü\n\nHangi işlemi yapmak istiyorsunuz?',
    Markup.inlineKeyboard(mainMenuButtons()),
  );
}

async function showDatePicker(ctx: Context, s: FinanceWizardSession) {
  s.step = 'pickDate';

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const label =
    s.action === 'expense'
      ? 'Gider'
      : s.action === 'donation'
        ? 'Bağış'
        : 'Aidat';

  return ctx.reply(
    `💰 ${s.associationName} — ${label.toUpperCase()}\n` +
      `Tutar: ${kurusToTl(s.amountInKurus!)}\n` +
      (s.description ? `Açıklama: ${s.description}\n` : '') +
      `\nİşlem tarihini seçin:`,
    Markup.inlineKeyboard([
      [Markup.button.callback(`📅 Bugün (${formatDate(todayStr)})`, `fin:date:${todayStr}`)],
      [Markup.button.callback(`📅 Dün (${formatDate(yesterdayStr)})`, `fin:date:${yesterdayStr}`)],
      [Markup.button.callback('📝 Tarih Gir (YYYY-AA-GG)', 'fin:date:manual')],
      [Markup.button.callback('🔙 Geri', 'fin:back_desc')],
      [Markup.button.callback('❌ İptal', 'fin:cancel')],
    ]),
  );
}

async function showConfirmMessage(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
) {
  s.step = 'confirm';

  const label =
    s.action === 'expense'
      ? 'Gider'
      : s.action === 'donation'
        ? 'Bağış'
        : 'Aidat';

  let warning = '';
  let buttons: ReturnType<typeof Markup.button.callback>[][] = [
    [Markup.button.callback('✅ Onayla', 'fin:confirm')],
    [Markup.button.callback('🔙 Geri', 'fin:back_date')],
    [Markup.button.callback('❌ İptal', 'fin:cancel')],
  ];

  if (s.action === 'expense' && s.associationId && s.amountInKurus != null) {
    const balance = await getCurrentBalance(prisma, s.associationId);
    if (balance < s.amountInKurus) {
      const deficit = s.amountInKurus - balance;
      warning =
        `\n⚠️ UYARI: Kasa bakiyesi ${kurusToTl(balance)}. ` +
        `Bu işlem sonrası bakiye ${kurusToTl(balance - s.amountInKurus)} olacak.\n`;
      buttons = [
        [Markup.button.callback('✅ Yine de Onayla', 'fin:confirm_negative')],
        [Markup.button.callback('🔙 Geri', 'fin:back_date')],
        [Markup.button.callback('❌ İptal', 'fin:cancel')],
      ];
    }
  }

  return ctx.reply(
    `💰 ${label} Kaydı\n\n` +
      `Dernek: ${s.associationName}\n` +
      `Kategori: ${s.categoryName}\n` +
      `Tutar: ${kurusToTl(s.amountInKurus!)}\n` +
      (s.description ? `Açıklama: ${s.description}\n` : '') +
      `Tarih: ${formatDate(s.transactionDate)}\n` +
      warning +
      `\nOnaylıyor musunuz?`,
    Markup.inlineKeyboard(buttons),
  );
}

async function showHistory(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
  page: number,
) {
  if (!s.associationId) return;

  const [rows, total] = await prisma.$transaction([
    prisma.transaction.findMany({
      where: { associationId: s.associationId, deletedAt: null },
      skip: (page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      orderBy: { transactionDate: 'desc' },
      include: {
        category: { select: { name: true } },
      },
    }),
    prisma.transaction.count({
      where: { associationId: s.associationId, deletedAt: null },
    }),
  ]);

  if (rows.length === 0) {
    return ctx.reply(
      '📜 İşlem geçmişi boş.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
      ]),
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  let text = `📜 ${s.associationName} — İşlem Geçmişi\n`;
  text += `Sayfa ${page}/${totalPages} (Toplam ${total} işlem)\n\n`;

  for (const r of rows) {
    const typeLabel = r.type === 'INCOME' ? '🟢 Gelir' : '🔴 Gider';
    const catName = r.category?.name ?? 'Kategori yok';
    const dateStr = r.transactionDate.toLocaleDateString('tr-TR');
    text += `${typeLabel} | ${catName}\n`;
    text += `💵 ${kurusToTl(r.amountInKurus)} | 📅 ${dateStr}\n`;
    if (r.description) text += `📝 ${r.description}\n`;
    text += `\n`;
  }

  const navButtons: ReturnType<typeof Markup.button.callback>[][] = [];
  if (page > 1) {
    navButtons.push([Markup.button.callback('⬅️ Önceki', `fin:history_page:${page - 1}`)]);
  }
  if (page < totalPages) {
    navButtons.push([Markup.button.callback('➡️ Sonraki', `fin:history_page:${page + 1}`)]);
  }
  navButtons.push([Markup.button.callback('🔙 Ana Menü', 'fin:menu')]);

  return ctx.reply(text, Markup.inlineKeyboard(navButtons));
}

async function showMonthlyStats(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
) {
  if (!s.associationId) return;

  const now = new Date();
  const months: { label: string; income: number; expense: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const label = d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });

    const [incomeAgg, expenseAgg] = await prisma.$transaction([
      prisma.transaction.aggregate({
        where: {
          associationId: s.associationId,
          type: 'INCOME',
          deletedAt: null,
          transactionDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amountInKurus: true },
      }),
      prisma.transaction.aggregate({
        where: {
          associationId: s.associationId,
          type: 'EXPENSE',
          deletedAt: null,
          transactionDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amountInKurus: true },
      }),
    ]);

    months.push({
      label,
      income: incomeAgg._sum.amountInKurus ?? 0,
      expense: expenseAgg._sum.amountInKurus ?? 0,
    });
  }

  let text = `📊 ${s.associationName} — Aylık Özet (Son 6 Ay)\n\n`;
  for (const m of months) {
    const balance = m.income - m.expense;
    text += `📅 ${m.label}\n`;
    text += `  🟢 Gelir: ${kurusToTl(m.income)}\n`;
    text += `  🔴 Gider: ${kurusToTl(m.expense)}\n`;
    text += `  📈 Bakiye: ${kurusToTl(balance)}\n\n`;
  }

  return ctx.reply(
    text,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
    ]),
  );
}

async function assertFinanceAccess(
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
      role: { in: [UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY] },
    },
  });
  if (membership) return true;

  const permission = await prisma.financePermission.findFirst({
    where: {
      associationId,
      userId,
      isActive: true,
      revokedAt: null,
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
): Promise<Array<{ id: string; name: string }>> {
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
  const out: Array<{ id: string; name: string }> = [];
  for (const m of memberships) {
    const assoc = m.association;
    if (seen.has(assoc.id)) continue;
    seen.add(assoc.id);

    const hasAccess = await assertFinanceAccess(prisma, userId, assoc.id);
    if (hasAccess) {
      out.push({ id: assoc.id, name: assoc.name });
    }
  }
  return out;
}

async function startWizard(
  ctx: Context,
  prisma: PrismaService,
  telegramUserId: number,
  action?: FinanceAction,
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
    return ctx.reply('Aktif bir dernek üyeliğin bulunamadı.');
  }

  if (assocs.length === 1) {
    const a = assocs[0];
    const hasAccess = await assertFinanceAccess(prisma, account.userId, a.id);
    if (!hasAccess) {
      return ctx.reply(
        '💰 Finans işlemleri için yetkin yok. Sadece başkan veya yetki verilmiş kullanıcılar finans işlemi yapabilir.',
      );
    }

    const existing = sessions.get(telegramUserId);
    const session: FinanceWizardSession = {
      userId: account.userId,
      step: action && ['expense', 'donation', 'fee'].includes(action) ? 'pickCategory' : 'pickType',
      action,
      associationId: a.id,
      associationName: a.name,
      amountInKurus: existing?.amountInKurus,
      description: existing?.description,
      transactionDate: existing?.transactionDate,
      confirmNegative: existing?.confirmNegative,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(telegramUserId, session);

    if (action === 'history') {
      session.step = 'idle';
      return showHistory(ctx, prisma, session, 1);
    }
    if (action === 'stats') {
      session.step = 'idle';
      return showMonthlyStats(ctx, prisma, session);
    }
    if (action === 'summary') {
      session.step = 'idle';
      const summary = await prisma.transaction.aggregate({
        _sum: { amountInKurus: true },
        where: { associationId: a.id, type: 'INCOME', deletedAt: null },
      });
      const expenseSum = await prisma.transaction.aggregate({
        _sum: { amountInKurus: true },
        where: { associationId: a.id, type: 'EXPENSE', deletedAt: null },
      });
      const income = summary._sum.amountInKurus ?? 0;
      const expense = expenseSum._sum.amountInKurus ?? 0;
      return ctx.reply(
        `📊 ${a.name} Kasa Durumu\n\n` +
          `💵 Toplam Gelir: ${kurusToTl(income)}\n` +
          `💸 Toplam Gider: ${kurusToTl(expense)}\n` +
          `📈 Bakiye: ${kurusToTl(income - expense)}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
        ]),
      );
    }

    if (action && ['expense', 'donation', 'fee'].includes(action)) {
      return showCategoryPicker(ctx, prisma, session);
    }
    return showMainMenu(ctx);
  }

  const existing = sessions.get(telegramUserId);
  const session: FinanceWizardSession = {
    userId: account.userId,
    step: 'pickAssoc',
    action,
    assocOptions: assocs,
    amountInKurus: existing?.amountInKurus,
    description: existing?.description,
    transactionDate: existing?.transactionDate,
    confirmNegative: existing?.confirmNegative,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(telegramUserId, session);

  const buttons = assocs.map((a) => [
    Markup.button.callback(a.name, `fin:assoc:${a.id}`),
  ]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);
  return ctx.reply(
    '💰 Finans İşlemi\n\nHangi dernek için işlem yapacaksın?',
    Markup.inlineKeyboard(buttons),
  );
}

async function showCategoryPicker(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
) {
  if (!s.associationId || !s.action) return;

  // Aidat akışında kategori seçimi atlanır (Aidat Geliri otomatik)
  if (s.action === 'fee') {
    s.step = 'pickMember';
    return showMemberPicker(ctx, prisma, s);
  }

  s.step = 'pickCategory';

  const type: TransactionType =
    s.action === 'donation' ? 'INCOME' : 'EXPENSE';

  let categories = await prisma.transactionCategory.findMany({
    where: {
      associationId: s.associationId,
      type,
      deletedAt: null,
      isActive: true,
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  if (categories.length === 0) {
    const defaultName = type === 'INCOME' ? 'Bağış' : 'Genel Gider';
    const created = await prisma.transactionCategory.create({
      data: {
        associationId: s.associationId,
        name: defaultName,
        type,
      },
      select: { id: true, name: true },
    });
    categories = [created];
  }

  const buttons = categories.map((c) => [
    Markup.button.callback(c.name, `fin:cat:${c.id}:${c.name}`),
  ]);
  buttons.push([Markup.button.callback('🔙 Geri', 'fin:back_menu')]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);

  const label =
    s.action === 'expense'
      ? 'gider'
      : s.action === 'donation'
        ? 'bağış'
        : 'işlem';

  return ctx.reply(
    `💰 ${s.associationName} — ${label.toUpperCase()}\n\nKategori seçin:`,
    Markup.inlineKeyboard(buttons),
  );
}

async function showMemberPicker(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
) {
  if (!s.associationId) return;

  s.step = 'pickMember';

  const members = await prisma.associationMembership.findMany({
    where: {
      associationId: s.associationId,
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      user: { select: { fullName: true } },
    },
    orderBy: { user: { fullName: 'asc' } },
  });

  if (members.length === 0) {
    sessions.delete(ctx.from!.id);
    return ctx.reply(
      'Bu dernekte aktif üye bulunamadı.',
      Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
      ]),
    );
  }

  s.memberOptions = members.map((m) => ({ id: m.id, name: m.user.fullName }));

  const buttons = members.map((m) => [
    Markup.button.callback(m.user.fullName, `fin:mem:${m.id}:${m.user.fullName}`),
  ]);
  buttons.push([Markup.button.callback('🔙 Geri', 'fin:back_menu')]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);

  return ctx.reply(
    `💰 ${s.associationName} — AİDAT\n\nÜye seçin:`,
    Markup.inlineKeyboard(buttons),
  );
}

async function showMonthPicker(ctx: Context, s: FinanceWizardSession) {
  s.step = 'pickMonth';

  const now = new Date();
  const months: string[] = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const buttons = months.map((m) => [
    Markup.button.callback(m, `fin:month:${m}`),
  ]);
  buttons.push([Markup.button.callback('🔙 Geri', 'fin:back_member')]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);

  return ctx.reply(
    `💰 ${s.associationName} — AİDAT\nÜye: ${s.membershipName}\n\nAy seçin:`,
    Markup.inlineKeyboard(buttons),
  );
}

async function persistTransaction(
  prisma: PrismaService,
  s: FinanceWizardSession,
): Promise<string> {
  if (!s.associationId || s.amountInKurus == null) {
    throw new Error('Eksik bilgi');
  }

  const txDate = s.transactionDate ? new Date(s.transactionDate) : new Date();

  // Gider işlemlerinde bakiye kontrolü
  if (s.action === 'expense') {
    const balance = await getCurrentBalance(prisma, s.associationId);
    if (balance < s.amountInKurus && !s.confirmNegative) {
      throw new Error(
        `Kasa bakiyesi ${kurusToTl(balance)}. Bu işlem sonrası bakiye ` +
          `${kurusToTl(balance - s.amountInKurus)} olacak. Onaylamak için tekrar deneyin.`,
      );
    }
  }

  // Aidat kaydı — özel işlem
  if (s.action === 'fee') {
    if (!s.membershipId || !s.month) {
      throw new Error('Aidat için üye ve ay bilgisi gerekli');
    }

    const membership = await prisma.associationMembership.findFirst({
      where: {
        id: s.membershipId,
        associationId: s.associationId,
        isActive: true,
        deletedAt: null,
      },
      include: { user: { select: { fullName: true } } },
    });
    if (!membership) throw new Error('Üyelik bulunamadı');

    const [year, month] = s.month.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Aynı üye için aynı ayda çift kayıt önleme
    const existing = await prisma.transaction.findFirst({
      where: {
        associationId: s.associationId,
        type: 'INCOME',
        createdById: s.userId,
        transactionDate: { gte: periodStart, lte: periodEnd },
        description: { startsWith: `Aidat - ${s.month}` },
      },
    });
    if (existing) {
      throw new Error(`${s.month} ayı için bu üyeye ait aidat kaydı zaten var`);
    }

    let category = await prisma.transactionCategory.findFirst({
      where: {
        associationId: s.associationId,
        name: 'Aidat Geliri',
        type: 'INCOME',
        deletedAt: null,
      },
    });
    if (!category) {
      category = await prisma.transactionCategory.create({
        data: {
          associationId: s.associationId,
          name: 'Aidat Geliri',
          type: 'INCOME',
        },
      });
    }

    await prisma.transaction.create({
      data: {
        associationId: s.associationId,
        categoryId: category.id,
        type: 'INCOME',
        amountInKurus: s.amountInKurus,
        description:
          s.description ||
          `Aidat - ${s.month} - ${membership.user.fullName}`,
        transactionDate: txDate,
        createdById: s.userId,
      },
    });

    return (
      `✅ Aidat kaydedildi.\n` +
      `Üye: ${membership.user.fullName}\n` +
      `Ay: ${s.month}\n` +
      `Tutar: ${kurusToTl(s.amountInKurus)}\n` +
      `Tarih: ${formatDate(s.transactionDate)}\n` +
      (s.associationName ? `Dernek: ${s.associationName}` : '')
    );
  }

  // Normal gelir/gider/bağış
  if (!s.categoryId) {
    throw new Error('Kategori bilgisi eksik');
  }

  const description =
    s.description ||
    (s.action === 'donation'
      ? 'Anonim bağış (Telegram)'
      : `${s.action?.toUpperCase()} işlemi (Telegram)`);

  await prisma.transaction.create({
    data: {
      associationId: s.associationId,
      categoryId: s.categoryId,
      type: s.action === 'donation' ? 'INCOME' : 'EXPENSE',
      amountInKurus: s.amountInKurus,
      description,
      transactionDate: txDate,
      createdById: s.userId,
    },
  });

  return (
    `✅ ${kurusToTl(s.amountInKurus)} tutarında kayıt oluşturuldu.\n` +
    `Kategori: ${s.categoryName}\n` +
    `Tarih: ${formatDate(s.transactionDate)}\n` +
    (s.associationName ? `Dernek: ${s.associationName}` : '')
  );
}

// ---------------------------------------------------------------------------
// Quick commands (/gelir, /gider, /bagis, /kasa)
// ---------------------------------------------------------------------------

function parseQuickCommand(
  text: string,
): { amount: number; description: string } | null {
  const parts = text.split(' ').slice(1);
  if (parts.length === 0) return null;

  const amountStr = parts[0].replace(/,/g, '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;

  const description = parts.slice(1).join(' ') || '';
  return { amount: Math.round(amount * 100), description };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerFinanceWizard(
  bot: Telegraf,
  prisma: PrismaService,
) {
  // /finans — Ana menü
  bot.command('finans', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    return startWizard(ctx, prisma, fromId);
  });

  // /gider <tutar> [açıklama]
  bot.command('gider', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const parsed = parseQuickCommand(ctx.message.text);
    if (!parsed) {
      return ctx.reply('Kullanım: /gider <tutar> [açıklama]\nÖrn: /gider 500 Kira ödemesi');
    }
    evictExpired(Date.now());
    sessions.set(fromId, {
      userId: '',
      step: 'amount',
      action: 'expense',
      amountInKurus: parsed.amount,
      description: parsed.description || undefined,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return startWizard(ctx, prisma, fromId, 'expense');
  });

  // /bagis <tutar> [açıklama]
  bot.command('bagis', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const parsed = parseQuickCommand(ctx.message.text);
    if (!parsed) {
      return ctx.reply('Kullanım: /bagis <tutar> [açıklama]\nÖrn: /bagis 1000 Ramazan bağışı');
    }
    evictExpired(Date.now());
    sessions.set(fromId, {
      userId: '',
      step: 'amount',
      action: 'donation',
      amountInKurus: parsed.amount,
      description: parsed.description || undefined,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return startWizard(ctx, prisma, fromId, 'donation');
  });

  // /aidat
  bot.command('aidat', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    return startWizard(ctx, prisma, fromId, 'fee');
  });

  // /kasa
  bot.command('kasa', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    return startWizard(ctx, prisma, fromId, 'summary');
  });

  // /gecmis
  bot.command('gecmis', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    return startWizard(ctx, prisma, fromId, 'history');
  });

  // /ozet
  bot.command('ozet', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    return startWizard(ctx, prisma, fromId, 'stats');
  });

  // /iptal (finans akışı için)
  bot.command('iptal', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    if (sessions.delete(fromId)) {
      return ctx.reply('Finans işlemi iptal edildi.');
    }
    return ctx.reply('Aktif bir finans işlemin yok.');
  });

  // -------------------------------------------------------------------------
  // Inline callbacks
  // -------------------------------------------------------------------------

  bot.action('fin:cancel', async (ctx) => {
    const fromId = ctx.from?.id;
    if (fromId) sessions.delete(fromId);
    await ctx.answerCbQuery('İptal edildi');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply('Finans işlemi iptal edildi.');
  });

  bot.action('fin:menu', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (s) {
      s.step = 'pickType';
      s.action = undefined;
      s.categoryId = undefined;
      s.categoryName = undefined;
      s.membershipId = undefined;
      s.membershipName = undefined;
      s.month = undefined;
      s.amountInKurus = undefined;
      s.description = undefined;
      s.transactionDate = undefined;
      s.confirmNegative = undefined;
      touch(s);
    }
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showMainMenu(ctx);
  });

  bot.action('fin:back_menu', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    let s = sessions.get(fromId);
    if (!s) {
      await ctx.answerCbQuery();
      return startWizard(ctx, prisma, fromId);
    }
    s.step = 'pickType';
    s.action = undefined;
    s.categoryId = undefined;
    s.categoryName = undefined;
    s.membershipId = undefined;
    s.membershipName = undefined;
    s.month = undefined;
    s.amountInKurus = undefined;
    s.description = undefined;
    s.transactionDate = undefined;
    s.confirmNegative = undefined;
    touch(s);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showMainMenu(ctx);
  });

  bot.action('fin:back_member', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s) return ctx.answerCbQuery('Akış güncel değil');
    s.step = 'pickMember';
    s.month = undefined;
    touch(s);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showMemberPicker(ctx, prisma, s);
  });

  bot.action('fin:back_desc', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s) return ctx.answerCbQuery('Akış güncel değil');
    s.step = 'description';
    s.transactionDate = undefined;
    touch(s);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      `Tutar: ${kurusToTl(s.amountInKurus!)}\n\n` +
        'Açıklama girin (isteğe bağlı, atlamak için "-" yazın):',
      Markup.inlineKeyboard([
        [Markup.button.callback('⏭️ Atla', 'fin:skip_desc')],
        [Markup.button.callback('❌ İptal', 'fin:cancel')],
      ]),
    );
  });

  bot.action('fin:back_date', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s) return ctx.answerCbQuery('Akış güncel değil');
    s.step = 'pickDate';
    s.transactionDate = undefined;
    touch(s);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showDatePicker(ctx, s);
  });

  bot.action(/^fin:assoc:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickAssoc') return ctx.answerCbQuery('Akış güncel değil');

    const assocId = ctx.match[1];
    const picked = (s.assocOptions ?? []).find((a) => a.id === assocId);
    if (!picked) return ctx.answerCbQuery('Geçersiz seçim');

    const account = await prisma.telegramAccount.findUnique({
      where: { telegramId: BigInt(fromId) },
      select: { userId: true },
    });
    if (!account) {
      sessions.delete(fromId);
      return ctx.answerCbQuery('Hesabınız bağlı değil', { show_alert: true });
    }

    const hasAccess = await assertFinanceAccess(prisma, account.userId, assocId);
    if (!hasAccess) {
      sessions.delete(fromId);
      return ctx.answerCbQuery(
        'Finans işlemleri için yetkiniz yok',
        { show_alert: true },
      );
    }

    s.associationId = picked.id;
    s.associationName = picked.name;
    s.userId = account.userId;
    s.step = s.action && ['expense', 'donation', 'fee'].includes(s.action) ? 'pickCategory' : 'pickType';
    touch(s);

    await ctx.answerCbQuery(picked.name);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    if (s.action === 'history') {
      s.step = 'idle';
      return showHistory(ctx, prisma, s, 1);
    }
    if (s.action === 'stats') {
      s.step = 'idle';
      return showMonthlyStats(ctx, prisma, s);
    }
    if (s.action === 'summary') {
      s.step = 'idle';
      const summary = await prisma.transaction.aggregate({
        _sum: { amountInKurus: true },
        where: { associationId: s.associationId, type: 'INCOME', deletedAt: null },
      });
      const expenseSum = await prisma.transaction.aggregate({
        _sum: { amountInKurus: true },
        where: { associationId: s.associationId, type: 'EXPENSE', deletedAt: null },
      });
      const income = summary._sum.amountInKurus ?? 0;
      const expense = expenseSum._sum.amountInKurus ?? 0;
      return ctx.reply(
        `📊 ${s.associationName} Kasa Durumu\n\n` +
          `💵 Toplam Gelir: ${kurusToTl(income)}\n` +
          `💸 Toplam Gider: ${kurusToTl(expense)}\n` +
          `📈 Bakiye: ${kurusToTl(income - expense)}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
        ]),
      );
    }

    if (s.action && ['expense', 'donation', 'fee'].includes(s.action)) {
      return showCategoryPicker(ctx, prisma, s);
    }
    return showMainMenu(ctx);
  });

  bot.action(/^fin:mem:([^:]+):(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickMember') return ctx.answerCbQuery('Akış güncel değil');

    s.membershipId = ctx.match[1];
    s.membershipName = ctx.match[2];
    touch(s);

    await ctx.answerCbQuery(s.membershipName);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showMonthPicker(ctx, s);
  });

  bot.action(/^fin:month:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickMonth') return ctx.answerCbQuery('Akış güncel değil');

    s.month = ctx.match[1];
    s.step = 'amount';
    touch(s);

    await ctx.answerCbQuery(s.month);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      `💰 ${s.associationName} — AİDAT\nÜye: ${s.membershipName}\nAy: ${s.month}\n\nTutarı girin (örn: 150 veya 150.50):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Geri', 'fin:back_member')],
        [Markup.button.callback('❌ İptal', 'fin:cancel')],
      ]),
    );
  });

  // Ana menü action seçimi
  bot.action(/^fin:(expense|donation|fee|summary|history|stats)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    let s = sessions.get(fromId);
    const action = ctx.match[1] as FinanceAction;

    if (!s) {
      await ctx.answerCbQuery();
      return startWizard(ctx, prisma, fromId, action);
    }

    s.action = action;
    touch(s);

    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    if (action === 'history') {
      s.step = 'idle';
      return showHistory(ctx, prisma, s, 1);
    }
    if (action === 'stats') {
      s.step = 'idle';
      return showMonthlyStats(ctx, prisma, s);
    }
    if (action === 'summary') {
      s.step = 'idle';
      if (!s.associationId) return ctx.reply('Dernek bilgisi eksik');
      const summary = await prisma.transaction.aggregate({
        _sum: { amountInKurus: true },
        where: { associationId: s.associationId, type: 'INCOME', deletedAt: null },
      });
      const expenseSum = await prisma.transaction.aggregate({
        _sum: { amountInKurus: true },
        where: { associationId: s.associationId, type: 'EXPENSE', deletedAt: null },
      });
      const income = summary._sum.amountInKurus ?? 0;
      const expense = expenseSum._sum.amountInKurus ?? 0;
      return ctx.reply(
        `📊 ${s.associationName} Kasa Durumu\n\n` +
          `💵 Toplam Gelir: ${kurusToTl(income)}\n` +
          `💸 Toplam Gider: ${kurusToTl(expense)}\n` +
          `📈 Bakiye: ${kurusToTl(income - expense)}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
        ]),
      );
    }

    s.step = 'pickCategory';
    return showCategoryPicker(ctx, prisma, s);
  });

  // Kategori seçimi
  bot.action(/^fin:cat:([^:]+):(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickCategory') return ctx.answerCbQuery('Akış güncel değil');

    s.categoryId = ctx.match[1];
    s.categoryName = ctx.match[2];

    // Hızlı komut ile amount zaten set edilmiş olabilir
    if (s.amountInKurus != null) {
      s.step = 'description';
      touch(s);
      await ctx.answerCbQuery(s.categoryName!);
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return ctx.reply(
        `Tutar: ${kurusToTl(s.amountInKurus)}\n\n` +
          'Açıklama girin (isteğe bağlı, atlamak için "-" yazın):',
        Markup.inlineKeyboard([
          [Markup.button.callback('⏭️ Atla', 'fin:skip_desc')],
          [Markup.button.callback('🔙 Geri', 'fin:back_menu')],
          [Markup.button.callback('❌ İptal', 'fin:cancel')],
        ]),
      );
    }

    s.step = 'amount';
    touch(s);
    await ctx.answerCbQuery(s.categoryName!);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      `💰 ${s.categoryName}\n\nTutarı girin (örn: 150 veya 150.50):`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Geri', 'fin:back_menu')],
        [Markup.button.callback('❌ İptal', 'fin:cancel')],
      ]),
    );
  });

  // Tarih seçimi
  bot.action(/^fin:date:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickDate') return ctx.answerCbQuery('Akış güncel değil');

    const value = ctx.match[1];
    if (value === 'manual') {
      await ctx.answerCbQuery('Tarih girin');
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return ctx.reply(
        'Tarihi YYYY-AA-GG formatında girin (örn: 2026-05-07):',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Geri', 'fin:back_desc')],
          [Markup.button.callback('❌ İptal', 'fin:cancel')],
        ]),
      );
    }

    s.transactionDate = value;
    s.step = 'confirm';
    touch(s);
    await ctx.answerCbQuery(formatDate(value));
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showConfirmMessage(ctx, prisma, s);
  });

  // İşlem geçmişi sayfalama
  bot.action(/^fin:history_page:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const page = parseInt(ctx.match[1], 10);

    // history action'da session siliniyor, bu yüzden associationId'yi başka türlü bulmamız gerek
    // Kullanıcı history sonrası ana menüden tekrar girebilir, ama burada session yoksa
    // associationId bilinmiyor. Bu yüzden history gösterirken session'ı silmek yerine
    // associationId ve name'i koruyabiliriz, veya kullanıcıdan tekrar seçim yapmasını isteyebiliriz.
    // En pratik çözüm: session'da tutmak yerine, showHistory çağrıldığında mesajı edit etmek.
    // Ancak Telegraf'ta editMessageText kullanabiliriz.

    // Daha basit çözüm: session'ı history için koruyalım ama step='idle' yapalım.
    // Mevcut kodda sessions.delete(fromId) yapılıyor. Bunu kaldırıp s.step='idle' yapalım.
    // Şu anda history ve stats'ta session siliniyor. Bunu değiştirmemiz gerekecek.
    // Ancak bu action handler zaten çalışmaz çünkü session yok.

    // Çözüm: history/stats'ta session'ı tamamen silmek yerine, step'i boş bir string yaparız.
    // Ya da session'ı koruruz ve sadece history context'ini mesaj içinde tutarız.

    // Hmm, mevcut kodda showHistory çağrıldığında ctx.reply kullanılıyor. editMessageText
    // için mesaj ID'si lazım. Telegraf ctx.editMessageText kullanılabilir callback query'de.

    // Aslında daha iyi çözüm: history ve stats için session'ı kaldırmak yerine,
    // kullanıcı `fin:menu` ile manuel olarak çıksın. Session'da associationId kalsın.
    // Ama mevcut kodda startWizard içinde action === 'history' || 'stats' || 'summary'
    // için sessions.delete(fromId) yapılıyor. Bunu kaldırmalıyız.

    // Şu anda bu callback çalışmaz çünkü session silinmiş olur. Hemen düzeltmem lazım.
    // startWizard'daki history/stats/summary için sessions.delete'leri kaldıracağım
    // ve showHistory/showMonthlyStats'tan sonra session'ı idle yapacağım.

    // Ama şu anda bu kodu yazıyorum. Hemen düzeltme yapmam lazım.
    // Aslında düzeltmeyi zaten startWizard'da yapmalıyım.
    // startWizard'da single assoc durumunda history/stats/summary için session siliniyor.
    // Bunu kaldıracağım.

    // Şimdilik bu handler'da session kontrolü yapalım, yoksa ana menüye yönlendirelim.
    const s = sessions.get(fromId);
    if (!s || !s.associationId) {
      await ctx.answerCbQuery('Oturum sona erdi');
      return ctx.reply(
        'Oturum sona erdi. Tekrar başlamak için:',
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
        ]),
      );
    }
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showHistory(ctx, prisma, s, page);
  });

  async function executeConfirm(
    ctx: Context,
    s: FinanceWizardSession,
    fromId: number,
  ) {
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
      const msg = await persistTransaction(prisma, s);
      s.step = 'pickType';
      s.action = undefined;
      s.categoryId = undefined;
      s.categoryName = undefined;
      s.membershipId = undefined;
      s.membershipName = undefined;
      s.month = undefined;
      s.amountInKurus = undefined;
      s.description = undefined;
      s.transactionDate = undefined;
      s.confirmNegative = undefined;
      touch(s);
      return ctx.reply(
        msg,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
        ]),
      );
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      sessions.delete(fromId);
      return ctx.reply(
        `❌ Kaydedilemedi: ${m}`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
        ]),
      );
    }
  }

  // Onay
  bot.action('fin:confirm', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'confirm') return ctx.answerCbQuery('Akış güncel değil');

    if (s.action === 'expense' && s.associationId && s.amountInKurus != null && !s.confirmNegative) {
      const balance = await getCurrentBalance(prisma, s.associationId);
      if (balance < s.amountInKurus) {
        await ctx.answerCbQuery('Yetersiz bakiye', { show_alert: true });
        return showConfirmMessage(ctx, prisma, s);
      }
    }

    return executeConfirm(ctx, s, fromId);
  });

  // Eksiye düşme onayı
  bot.action('fin:confirm_negative', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'confirm') return ctx.answerCbQuery('Akış güncel değil');

    s.confirmNegative = true;
    touch(s);
    return executeConfirm(ctx, s, fromId);
  });

  // -------------------------------------------------------------------------
  // Free-text input (amount / description / date)
  // -------------------------------------------------------------------------

  bot.on('text', async (ctx, next) => {
    const fromId = ctx.from?.id;
    const text = ctx.message?.text;
    if (!fromId || !text || text.startsWith('/')) return next();

    const s = sessions.get(fromId);
    if (!s) return next();

    if (s.expiresAt <= Date.now()) {
      sessions.delete(fromId);
      return ctx.reply(
        'Finans işlemi zaman aşımına uğradı. Tekrar /finans yaz.',
      );
    }

    // Kullanıcı zaten bir dernek seçmişse hesabın hâlâ bağlı olduğunu kontrol et
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

    if (s.step === 'amount') {
      const amountStr = text.trim().replace(/,/g, '.');
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply(
          'Geçersiz tutar. Tekrar girin (örn: 150 veya 150.50):',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Geri', 'fin:back_menu')],
            [Markup.button.callback('❌ İptal', 'fin:cancel')],
          ]),
        );
      }
      s.amountInKurus = Math.round(amount * 100);
      s.step = 'description';
      touch(s);
      return ctx.reply(
        `Tutar: ${kurusToTl(s.amountInKurus)}\n\n` +
          'Açıklama girin (isteğe bağlı, atlamak için "-" yazın):',
        Markup.inlineKeyboard([
          [Markup.button.callback('⏭️ Atla', 'fin:skip_desc')],
          [Markup.button.callback('🔙 Geri', 'fin:back_menu')],
          [Markup.button.callback('❌ İptal', 'fin:cancel')],
        ]),
      );
    }

    if (s.step === 'description') {
      const desc = text.trim();
      s.description = desc === '-' ? undefined : desc;
      s.step = 'pickDate';
      touch(s);

      return showDatePicker(ctx, s);
    }

    if (s.step === 'pickDate') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const trimmed = text.trim();
      if (!dateRegex.test(trimmed)) {
        return ctx.reply(
          'Geçersiz tarih formatı. YYYY-AA-GG şeklinde girin (örn: 2026-05-07):',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Geri', 'fin:back_desc')],
            [Markup.button.callback('❌ İptal', 'fin:cancel')],
          ]),
        );
      }
      const parsed = new Date(trimmed);
      if (isNaN(parsed.getTime())) {
        return ctx.reply(
          'Geçersiz tarih. Lütfen geçerli bir tarih girin (örn: 2026-05-07):',
          Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Geri', 'fin:back_desc')],
            [Markup.button.callback('❌ İptal', 'fin:cancel')],
          ]),
        );
      }
      s.transactionDate = trimmed;
      s.step = 'confirm';
      touch(s);
      return showConfirmMessage(ctx, prisma, s);
    }

    return next();
  });

  // Açıklama atla
  bot.action('fin:skip_desc', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'description') return ctx.answerCbQuery('Akış güncel değil');

    s.step = 'pickDate';
    touch(s);
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    return showDatePicker(ctx, s);
  });
}
