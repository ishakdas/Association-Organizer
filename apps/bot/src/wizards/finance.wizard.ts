import { Telegraf, Markup, Context } from 'telegraf';
import {
  PrismaService,
  UserRole,
  TransactionType,
  PermissionAction,
} from '@ticketbot/database';

type FinanceStep =
  | 'pickAssoc'
  | 'pickType'
  | 'pickAmount'
  | 'pickCategory'
  | 'pickMember'
  | 'pickMonth'
  | 'idle'
  | 'pending_undo';

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
  donationTypeOptions?: Array<{ name: string }>;
  month?: string;
  amountInKurus?: number;
  description?: string;
  transactionDate?: string;
  confirmNegative?: boolean;
  expiresAt: number;
  lastUsedCategoryId?: string;
  lastAmountByCategory?: Record<string, number>;
  lastTransactionId?: string;
  undoMessageId?: number;
}

const sessions = new Map<number, FinanceWizardSession>();
const SESSION_TTL_MS = 10 * 60 * 1000;
const HISTORY_PAGE_SIZE = 8;
const UNDO_TIMEOUT_MS = 5000;

const undoTimers = new Map<number, NodeJS.Timeout>();

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
  return new Date(dateStr).toLocaleDateString('tr-TR');
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

async function showAmountPicker(ctx: Context, s: FinanceWizardSession) {
  s.step = 'pickAmount';
  touch(s);
  const label = s.action === 'expense' ? 'Gider' : s.action === 'donation' ? 'Bağış' : 'İşlem';
  return ctx.reply(
    `💰 ${s.associationName} — ${label.toUpperCase()}\n\nTutarı girin (örn: 500 veya 500.50):`,
    Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Geri', 'fin:back_menu')],
      [Markup.button.callback('❌ İptal', 'fin:cancel')],
    ]),
  );
}

async function showUndoMessage(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
  transactionId: string,
  label: string,
) {
  s.step = 'pending_undo';
  s.lastTransactionId = transactionId;

  const msg = await ctx.reply(
    `✅ ${label} kaydedildi: ${kurusToTl(s.amountInKurus!)}\n` +
      (s.description ? `📝 ${s.description}\n` : '') +
      `📅 ${formatDate(s.transactionDate)}`,
    Markup.inlineKeyboard([
      [Markup.button.callback('↩️ Geri Al (5s)', 'fin:undo')],
    ]),
  );

  s.undoMessageId = msg.message_id;
  const chatId = ctx.chat!.id;
  const messageId = msg.message_id;

  const timer = setTimeout(async () => {
    try {
      await ctx.telegram.editMessageText(
        chatId,
        messageId,
        undefined,
        `✅ ${label} kaydedildi: ${kurusToTl(s.amountInKurus!)}\n` +
          (s.description ? `📝 ${s.description}\n` : '') +
          `📅 ${formatDate(s.transactionDate)}\n\n✅ İşlem onaylandı.`,
      );
      s.step = 'idle';
      s.lastTransactionId = undefined;
      undoTimers.delete(ctx.from!.id);
    } catch {
      // Mesaj silinmiş olabilir, görmezden gel
    }
  }, UNDO_TIMEOUT_MS);

  undoTimers.set(ctx.from!.id, timer);
}

async function undoLastTransaction(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
) {
  const timer = undoTimers.get(ctx.from!.id);
  if (timer) {
    clearTimeout(timer);
    undoTimers.delete(ctx.from!.id);
  }

  if (!s.lastTransactionId) {
    return ctx.answerCbQuery('Geri alınacak işlem yok', { show_alert: true });
  }

  await prisma.transaction.update({
    where: { id: s.lastTransactionId },
    data: { deletedAt: new Date() },
  });

  const chatId = ctx.chat!.id;
  const messageId = s.undoMessageId;
  if (messageId) {
    try {
      await ctx.telegram.editMessageText(chatId, messageId, undefined, '↩️ İşlem geri alındı.');
    } catch {
      // Mesaj silinmiş olabilir
    }
  }

  s.lastTransactionId = undefined;
  s.undoMessageId = undefined;
  s.step = 'idle';

  return ctx.answerCbQuery('İşlem geri alındı');
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
      include: { category: { select: { name: true } } },
    }),
    prisma.transaction.count({ where: { associationId: s.associationId, deletedAt: null } }),
  ]);

  if (rows.length === 0) {
    return ctx.reply('📜 İşlem geçmişi boş.', Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
    ]));
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
  if (page > 1) navButtons.push([Markup.button.callback('⬅️ Önceki', `fin:history_page:${page - 1}`)]);
  if (page < totalPages) navButtons.push([Markup.button.callback('➡️ Sonraki', `fin:history_page:${page + 1}`)]);
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
        where: { associationId: s.associationId, type: 'INCOME', deletedAt: null, transactionDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amountInKurus: true },
      }),
      prisma.transaction.aggregate({
        where: { associationId: s.associationId, type: 'EXPENSE', deletedAt: null, transactionDate: { gte: monthStart, lte: monthEnd } },
        _sum: { amountInKurus: true },
      }),
    ]);

    months.push({ label, income: incomeAgg._sum.amountInKurus ?? 0, expense: expenseAgg._sum.amountInKurus ?? 0 });
  }

  let text = `📊 ${s.associationName} — Aylık Özet (Son 6 Ay)\n\n`;
  for (const m of months) {
    text += `📅 ${m.label}\n`;
    text += `  🟢 Gelir: ${kurusToTl(m.income)}\n`;
    text += `  🔴 Gider: ${kurusToTl(m.expense)}\n`;
    text += `  📈 Bakiye: ${kurusToTl(m.income - m.expense)}\n\n`;
  }

  return ctx.reply(text, Markup.inlineKeyboard([
    [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
  ]));
}

async function assertFinanceAccess(
  prisma: PrismaService,
  userId: string,
  associationId: string,
): Promise<boolean> {
  const membership = await prisma.associationMembership.findFirst({
    where: { userId, associationId, isActive: true, deletedAt: null, role: { in: [UserRole.ASSOCIATION_MANAGER, UserRole.ASSOCIATION_SECRETARY] } },
  });
  if (membership) return true;

  const permission = await prisma.permission.findFirst({
    where: { associationId, userId, action: PermissionAction.USE_FINANCE_COMMANDS },
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
    where: { userId, isActive: true, deletedAt: null, association: { deletedAt: null } },
    select: { association: { select: { id: true, name: true } } },
    orderBy: { association: { name: 'asc' } },
  });

  const seen = new Set<string>();
  const out: Array<{ id: string; name: string }> = [];
  for (const m of memberships) {
    const assoc = m.association;
    if (seen.has(assoc.id)) continue;
    seen.add(assoc.id);
    const hasAccess = await assertFinanceAccess(prisma, userId, assoc.id);
    if (hasAccess) out.push({ id: assoc.id, name: assoc.name });
  }
  return out;
}

async function getOrCreateCategory(
  prisma: PrismaService,
  associationId: string,
  name: string,
  type: TransactionType,
) {
  let category = await prisma.transactionCategory.findFirst({
    where: { associationId, name, type, deletedAt: null },
  });
  if (!category) {
    category = await prisma.transactionCategory.create({
      data: { associationId, name, type },
    });
  }
  return category;
}

// -------------------------------------------------------------------------
// HIZLI KOMUTLAR - DİREKT KAYDET + GERİ AL
// -------------------------------------------------------------------------

async function quickExpense(
  ctx: Context,
  prisma: PrismaService,
  fromId: number,
  amountInKurus: number,
  description: string | undefined,
) {
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: BigInt(fromId) },
    select: { userId: true },
  });
  if (!account) return ctx.reply('Önce hesabını bağlamalısın. /link <kod>');

  const assocs = await loadEligibleAssociations(prisma, account.userId);
  if (assocs.length === 0) return ctx.reply('Aktif bir dernek üyeliğin bulunamadı.');
  if (assocs.length > 1) {
    const session: FinanceWizardSession = {
      userId: account.userId,
      step: 'pickAssoc',
      action: 'expense',
      assocOptions: assocs,
      amountInKurus,
      description,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(fromId, session);
    const buttons = assocs.map((a) => [Markup.button.callback(a.name, `fin:assoc:${a.id}`)]);
    buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);
    return ctx.reply('💰 Hangi dernek için?', Markup.inlineKeyboard(buttons));
  }

  const a = assocs[0];
  const hasAccess = await assertFinanceAccess(prisma, account.userId, a.id);
  if (!hasAccess) return ctx.reply('💰 Finans yetkiniz yok.');

  const balance = await getCurrentBalance(prisma, a.id);
  if (balance < amountInKurus) {
    return ctx.reply(
      `⚠️ Kasa bakiyesi ${kurusToTl(balance)}. Bu işlem sonrası bakiye ${kurusToTl(balance - amountInKurus)} olacak.\n\nYine de kaydetmek için /gidernegatif ${amountInKurus / 100} yazın.`,
    );
  }

  const category = await getOrCreateCategory(prisma, a.id, 'Genel Gider', 'EXPENSE');
  const tx = await prisma.transaction.create({
    data: {
      associationId: a.id,
      categoryId: category.id,
      type: 'EXPENSE',
      amountInKurus,
      description: description || 'Gider',
      transactionDate: new Date(),
      createdById: account.userId,
    },
  });

  const session: FinanceWizardSession = {
    userId: account.userId,
    step: 'pending_undo',
    action: 'expense',
    associationId: a.id,
    associationName: a.name,
    amountInKurus,
    description,
    categoryId: category.id,
    categoryName: category.name,
    transactionDate: new Date().toISOString().split('T')[0],
    lastTransactionId: tx.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(fromId, session);

  return showUndoMessage(ctx, prisma, session, tx.id, 'Gider');
}

async function quickDonation(
  ctx: Context,
  prisma: PrismaService,
  fromId: number,
  amountInKurus: number,
  description: string | undefined,
) {
  const account = await prisma.telegramAccount.findUnique({
    where: { telegramId: BigInt(fromId) },
    select: { userId: true },
  });
  if (!account) return ctx.reply('Önce hesabını bağlamalısın. /link <kod>');

  const assocs = await loadEligibleAssociations(prisma, account.userId);
  if (assocs.length === 0) return ctx.reply('Aktif bir dernek üyeliğin bulunamadı.');
  if (assocs.length > 1) {
    const session: FinanceWizardSession = {
      userId: account.userId,
      step: 'pickAssoc',
      action: 'donation',
      assocOptions: assocs,
      amountInKurus,
      description,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(fromId, session);
    const buttons = assocs.map((a) => [Markup.button.callback(a.name, `fin:assoc:${a.id}`)]);
    buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);
    return ctx.reply('💰 Hangi dernek için?', Markup.inlineKeyboard(buttons));
  }

  const a = assocs[0];
  const hasAccess = await assertFinanceAccess(prisma, account.userId, a.id);
  if (!hasAccess) return ctx.reply('💰 Finans yetkiniz yok.');

  // Quick path (/bagis 500): no type selected → default "Genel".
  const category = await getOrCreateCategory(prisma, a.id, 'Genel', 'INCOME');
  const tx = await prisma.transaction.create({
    data: {
      associationId: a.id,
      categoryId: category.id,
      type: 'INCOME',
      amountInKurus,
      description: description || 'Bağış',
      transactionDate: new Date(),
      createdById: account.userId,
    },
  });

  const session: FinanceWizardSession = {
    userId: account.userId,
    step: 'pending_undo',
    action: 'donation',
    associationId: a.id,
    associationName: a.name,
    amountInKurus,
    description,
    categoryId: category.id,
    categoryName: category.name,
    transactionDate: new Date().toISOString().split('T')[0],
    lastTransactionId: tx.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(fromId, session);

  return showUndoMessage(ctx, prisma, session, tx.id, 'Bağış');
}

// -------------------------------------------------------------------------
// WIZARD (detaylı akış - /finans menüden)
// -------------------------------------------------------------------------

// Bağış türü seçici: global katalog (DonationCategoryDefinition) + derneğin
// kendi özel INCOME kategorileri birleştirilir. "Genel" her zaman ilk ve
// varsayılan ("atla") seçenektir. Seçenekler session'da indeksli tutulur ki
// callback_data 64 byte sınırını aşmasın.
async function showDonationTypePicker(
  ctx: Context,
  prisma: PrismaService,
  s: FinanceWizardSession,
) {
  if (!s.associationId) return;
  s.step = 'pickCategory';
  touch(s);

  const [defs, custom] = await Promise.all([
    prisma.donationCategoryDefinition.findMany({
      where: { isActive: true },
      select: { name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.transactionCategory.findMany({
      where: {
        associationId: s.associationId,
        type: 'INCOME',
        deletedAt: null,
        isActive: true,
      },
      select: { name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const names: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const n = raw.trim();
    const key = n.toLowerCase();
    if (n && !seen.has(key)) {
      seen.add(key);
      names.push(n);
    }
  };
  push('Genel'); // varsayılan, her zaman ilk
  for (const d of defs) push(d.name);
  for (const c of custom) push(c.name);

  s.donationTypeOptions = names.map((name) => ({ name }));

  const buttons = names.map((name, idx) => [
    Markup.button.callback(
      idx === 0 ? '🏷️ Genel (atla)' : name,
      `fin:dtype:${idx}`,
    ),
  ]);
  buttons.push([Markup.button.callback('🔙 Geri', 'fin:back_menu')]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);

  return ctx.reply(
    `🎁 ${s.associationName} — Bağış türü seçin:\n💵 ${kurusToTl(s.amountInKurus!)}`,
    Markup.inlineKeyboard(buttons),
  );
}

async function showCategoryPicker(ctx: Context, prisma: PrismaService, s: FinanceWizardSession) {
  if (!s.associationId || !s.action) return;
  if (s.action === 'fee') {
    s.step = 'pickMember';
    return showMemberPicker(ctx, prisma, s);
  }

  s.step = 'pickCategory';
  const type: TransactionType = s.action === 'donation' ? 'INCOME' : 'EXPENSE';

  let categories = await prisma.transactionCategory.findMany({
    where: { associationId: s.associationId, type, deletedAt: null, isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  if (categories.length === 0) {
    const defaultName = type === 'INCOME' ? 'Bağış' : 'Genel Gider';
    categories = [await prisma.transactionCategory.create({
      data: { associationId: s.associationId, name: defaultName, type },
      select: { id: true, name: true },
    })];
  }

  const sorted = [...categories].sort((a, b) => {
    if (a.id === s.lastUsedCategoryId) return -1;
    if (b.id === s.lastUsedCategoryId) return 1;
    return a.name.localeCompare(b.name);
  });

  const buttons = sorted.map((c) => {
    const label = c.id === s.lastUsedCategoryId ? `⭐ ${c.name}` : c.name;
    return [Markup.button.callback(label, `fin:cat:${c.id}:${c.name}`)];
  });
  buttons.push([Markup.button.callback('🔙 Geri', 'fin:back_menu')]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);

  return ctx.reply(
    `💰 ${s.associationName} — Kategori seçin:`,
    Markup.inlineKeyboard(buttons),
  );
}

async function showMemberPicker(ctx: Context, prisma: PrismaService, s: FinanceWizardSession) {
  if (!s.associationId) return;
  s.step = 'pickMember';

  const members = await prisma.associationMembership.findMany({
    where: { associationId: s.associationId, isActive: true, deletedAt: null },
    select: { id: true, user: { select: { fullName: true } } },
    orderBy: { user: { fullName: 'asc' } },
  });

  if (members.length === 0) {
    sessions.delete(ctx.from!.id);
    return ctx.reply('Bu dernekte aktif üye bulunamadı.', Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Ana Menü', 'fin:menu')],
    ]));
  }

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

  const buttons = months.map((m) => [Markup.button.callback(m, `fin:month:${m}`)]);
  buttons.push([Markup.button.callback('🔙 Geri', 'fin:back_member')]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);

  return ctx.reply(
    `💰 ${s.associationName} — AİDAT\nÜye: ${s.membershipName}\n\nAy seçin:`,
    Markup.inlineKeyboard(buttons),
  );
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
  if (!account) return ctx.reply('Önce hesabını bağlamalısın. /link <kod>');

  const assocs = await loadEligibleAssociations(prisma, account.userId);
  if (assocs.length === 0) {
    const hasAny = await prisma.associationMembership.findFirst({
      where: { userId: account.userId, isActive: true, deletedAt: null, association: { deletedAt: null } },
    });
    if (hasAny) return ctx.reply('💰 Finans yetkiniz yok.');
    return ctx.reply('Aktif bir dernek üyeliğin bulunamadı.');
  }

  if (assocs.length === 1) {
    const a = assocs[0];
    const hasAccess = await assertFinanceAccess(prisma, account.userId, a.id);
    if (!hasAccess) return ctx.reply('💰 Finans yetkiniz yok.');

    const session: FinanceWizardSession = {
      userId: account.userId,
      step: action === 'fee' ? 'pickCategory' : (action && ['expense', 'donation'].includes(action) ? 'pickAmount' : 'pickType'),
      action,
      associationId: a.id,
      associationName: a.name,
      expiresAt: Date.now() + SESSION_TTL_MS,
    };
    sessions.set(telegramUserId, session);

    if (action === 'history') { session.step = 'idle'; return showHistory(ctx, prisma, session, 1); }
    if (action === 'stats') { session.step = 'idle'; return showMonthlyStats(ctx, prisma, session); }
    if (action === 'summary') {
      session.step = 'idle';
      const [inc, exp] = await prisma.$transaction([
        prisma.transaction.aggregate({ _sum: { amountInKurus: true }, where: { associationId: a.id, type: 'INCOME', deletedAt: null } }),
        prisma.transaction.aggregate({ _sum: { amountInKurus: true }, where: { associationId: a.id, type: 'EXPENSE', deletedAt: null } }),
      ]);
      return ctx.reply(
        `📊 ${a.name} Kasa\n\n💵 Gelir: ${kurusToTl(inc._sum.amountInKurus ?? 0)}\n💸 Gider: ${kurusToTl(exp._sum.amountInKurus ?? 0)}\n📈 Bakiye: ${kurusToTl((inc._sum.amountInKurus ?? 0) - (exp._sum.amountInKurus ?? 0))}`,
        Markup.inlineKeyboard([[Markup.button.callback('🔙 Ana Menü', 'fin:menu')]]),
      );
    }

    if (action === 'fee') return showCategoryPicker(ctx, prisma, session);
    if (action && ['expense', 'donation'].includes(action)) return showAmountPicker(ctx, session);
    return showMainMenu(ctx);
  }

  const session: FinanceWizardSession = {
    userId: account.userId,
    step: 'pickAssoc',
    action,
    assocOptions: assocs,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(telegramUserId, session);

  const buttons = assocs.map((a) => [Markup.button.callback(a.name, `fin:assoc:${a.id}`)]);
  buttons.push([Markup.button.callback('❌ İptal', 'fin:cancel')]);
  return ctx.reply('💰 Hangi dernek için?', Markup.inlineKeyboard(buttons));
}

function parseQuickCommand(text: string): { amount: number; description: string } | null {
  const parts = text.split(' ').slice(1);
  if (parts.length === 0) return null;
  const amountStr = parts[0].replace(/,/g, '.');
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) return null;
  return { amount: Math.round(amount * 100), description: parts.slice(1).join(' ') || '' };
}

// -------------------------------------------------------------------------
// REGISTRATION
// -------------------------------------------------------------------------

export function registerFinanceWizard(bot: Telegraf, prisma: PrismaService) {
  // /finans
  bot.command('finans', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    try { return await startWizard(ctx, prisma, fromId); }
    catch { return ctx.reply('Beklenmeyen bir hata oluştu.'); }
  });

  // /gider [tutar] [açıklama] → tutar varsa direkt kaydet, yoksa tutar sor
  bot.command('gider', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    const parsed = parseQuickCommand(ctx.message.text);
    if (parsed) {
      try { return await quickExpense(ctx, prisma, fromId, parsed.amount, parsed.description || undefined); }
      catch (err) { return ctx.reply(`❌ ${(err as Error).message}`); }
    }
    // Tutar yoksa wizard başlat, tutar sor
    try { return await startWizard(ctx, prisma, fromId, 'expense'); }
    catch { return ctx.reply('Beklenmeyen bir hata oluştu.'); }
  });

  // /bagis [tutar] [açıklama] → tutar varsa direkt kaydet, yoksa tutar sor
  bot.command('bagis', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    const parsed = parseQuickCommand(ctx.message.text);
    if (parsed) {
      try { return await quickDonation(ctx, prisma, fromId, parsed.amount, parsed.description || undefined); }
      catch (err) { return ctx.reply(`❌ ${(err as Error).message}`); }
    }
    try { return await startWizard(ctx, prisma, fromId, 'donation'); }
    catch { return ctx.reply('Beklenmeyen bir hata oluştu.'); }
  });

  // /aidat → SADECE ÜYE SEÇ, AY/TUTAR OTOMATİK
  bot.command('aidat', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    try { return await startWizard(ctx, prisma, fromId, 'fee'); }
    catch { return ctx.reply('Beklenmeyen bir hata oluştu.'); }
  });

  // /kasa
  bot.command('kasa', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    try { return await startWizard(ctx, prisma, fromId, 'summary'); }
    catch { return ctx.reply('Beklenmeyen bir hata oluştu.'); }
  });

  // /gecmis
  bot.command('gecmis', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    try { return await startWizard(ctx, prisma, fromId, 'history'); }
    catch { return ctx.reply('Beklenmeyen bir hata oluştu.'); }
  });

  // /ozet
  bot.command('ozet', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    evictExpired(Date.now());
    try { return await startWizard(ctx, prisma, fromId, 'stats'); }
    catch { return ctx.reply('Beklenmeyen bir hata oluştu.'); }
  });

  // /iptal
  bot.command('iptal', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const timer = undoTimers.get(fromId);
    if (timer) { clearTimeout(timer); undoTimers.delete(fromId); }
    if (sessions.delete(fromId)) return ctx.reply('İptal edildi.');
    return ctx.reply('Aktif bir işlemin yok.');
  });

  // -------------------------------------------------------------------------
  // INLINE CALLBACKS
  // -------------------------------------------------------------------------

  bot.action('fin:undo', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return;
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pending_undo') return ctx.answerCbQuery('Geri alınacak işlem yok', { show_alert: true });
    return undoLastTransaction(ctx, prisma, s);
  });

  bot.action('fin:cancel', async (ctx) => {
    const fromId = ctx.from?.id;
    if (fromId) {
      const timer = undoTimers.get(fromId);
      if (timer) { clearTimeout(timer); undoTimers.delete(fromId); }
      sessions.delete(fromId);
    }
    await ctx.answerCbQuery('İptal edildi');
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply('İptal edildi.');
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
      s.donationTypeOptions = undefined;
      s.membershipId = undefined;
      s.membershipName = undefined;
      s.month = undefined;
      s.amountInKurus = undefined;
      s.description = undefined;
      s.transactionDate = undefined;
      s.lastTransactionId = undefined;
      s.undoMessageId = undefined;
      touch(s);
    }
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showMainMenu(ctx);
  });

  bot.action('fin:back_menu', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s) { await ctx.answerCbQuery(); return startWizard(ctx, prisma, fromId); }
    s.step = 'pickType';
    s.action = undefined;
    s.categoryId = undefined;
    s.categoryName = undefined;
    s.donationTypeOptions = undefined;
    s.membershipId = undefined;
    s.membershipName = undefined;
    s.month = undefined;
    s.amountInKurus = undefined;
    s.description = undefined;
    s.transactionDate = undefined;
    s.lastTransactionId = undefined;
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
    if (!account) { sessions.delete(fromId); return ctx.answerCbQuery('Hesabınız bağlı değil', { show_alert: true }); }

    const hasAccess = await assertFinanceAccess(prisma, account.userId, assocId);
    if (!hasAccess) { sessions.delete(fromId); return ctx.answerCbQuery('Finans yetkiniz yok', { show_alert: true }); }

    s.associationId = picked.id;
    s.associationName = picked.name;
    s.userId = account.userId;
    touch(s);

    await ctx.answerCbQuery(picked.name);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    // Hızlı komut ile gelen tutar varsa direkt kaydet
    if (s.amountInKurus != null) {
      if (s.action === 'expense') {
        return quickExpense(ctx, prisma, fromId, s.amountInKurus, s.description);
      }
      if (s.action === 'donation') {
        return quickDonation(ctx, prisma, fromId, s.amountInKurus, s.description);
      }
    }

    if (s.action === 'history') { s.step = 'idle'; return showHistory(ctx, prisma, s, 1); }
    if (s.action === 'stats') { s.step = 'idle'; return showMonthlyStats(ctx, prisma, s); }
    if (s.action === 'summary') {
      s.step = 'idle';
      const [inc, exp] = await prisma.$transaction([
        prisma.transaction.aggregate({ _sum: { amountInKurus: true }, where: { associationId: s.associationId, type: 'INCOME', deletedAt: null } }),
        prisma.transaction.aggregate({ _sum: { amountInKurus: true }, where: { associationId: s.associationId, type: 'EXPENSE', deletedAt: null } }),
      ]);
      return ctx.reply(
        `📊 ${s.associationName} Kasa\n\n💵 Gelir: ${kurusToTl(inc._sum.amountInKurus ?? 0)}\n💸 Gider: ${kurusToTl(exp._sum.amountInKurus ?? 0)}\n📈 Bakiye: ${kurusToTl((inc._sum.amountInKurus ?? 0) - (exp._sum.amountInKurus ?? 0))}`,
        Markup.inlineKeyboard([[Markup.button.callback('🔙 Ana Menü', 'fin:menu')]]),
      );
    }

    if (s.action === 'fee') return showCategoryPicker(ctx, prisma, s);
    if (s.action && ['expense', 'donation'].includes(s.action)) return showAmountPicker(ctx, s);
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

    // Aidat: Ay otomatik (bu ay), tutar otomatik (settings)
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s.month = month;

    const settings = await prisma.associationSettings.findUnique({
      where: { associationId: s.associationId },
      select: { monthlyFeeAmountKurus: true },
    });
    const amount = settings?.monthlyFeeAmountKurus ?? 0;
    if (amount === 0) {
      s.step = 'pickAmount';
      return ctx.reply(
        `💰 ${s.associationName} — AİDAT\nÜye: ${s.membershipName}\nAy: ${month}\n\nTutarı girin:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Geri', 'fin:back_member')],
          [Markup.button.callback('❌ İptal', 'fin:cancel')],
        ]),
      );
    }

    s.amountInKurus = amount;

    // Direkt kaydet + geri al
    const membership = await prisma.associationMembership.findFirst({
      where: { id: s.membershipId, associationId: s.associationId, isActive: true, deletedAt: null },
      include: { user: { select: { fullName: true, id: true } } },
    });
    if (!membership) return ctx.answerCbQuery('Üye bulunamadı', { show_alert: true });

    const category = await getOrCreateCategory(prisma, s.associationId!, 'Aidat Geliri', 'INCOME');
    const tx = await prisma.transaction.create({
      data: {
        associationId: s.associationId!,
        categoryId: category.id,
        type: 'INCOME',
        amountInKurus: amount,
        description: `Aidat - ${month} - ${membership.user.fullName}`,
        transactionDate: new Date(),
        createdById: s.userId,
      },
    });

    s.lastTransactionId = tx.id;
    s.categoryId = category.id;
    s.categoryName = category.name;
    s.transactionDate = new Date().toISOString().split('T')[0];

    return showUndoMessage(ctx, prisma, s, tx.id, `Aidat (${membership.user.fullName})`);
  });

  bot.action(/^fin:month:(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickMonth') return ctx.answerCbQuery('Akış güncel değil');

    s.month = ctx.match[1];
    const settings = await prisma.associationSettings.findUnique({
      where: { associationId: s.associationId },
      select: { monthlyFeeAmountKurus: true },
    });
    const amount = settings?.monthlyFeeAmountKurus ?? 0;
    if (amount > 0) {
      s.amountInKurus = amount;
      const membership = await prisma.associationMembership.findFirst({
        where: { id: s.membershipId, associationId: s.associationId, isActive: true, deletedAt: null },
        include: { user: { select: { fullName: true, id: true } } },
      });
      if (!membership) return ctx.answerCbQuery('Üye bulunamadı', { show_alert: true });

      const category = await getOrCreateCategory(prisma, s.associationId!, 'Aidat Geliri', 'INCOME');
      const tx = await prisma.transaction.create({
        data: {
          associationId: s.associationId!,
          categoryId: category.id,
          type: 'INCOME',
          amountInKurus: amount,
          description: `Aidat - ${s.month} - ${membership.user.fullName}`,
          transactionDate: new Date(),
          createdById: s.userId,
        },
      });

      s.lastTransactionId = tx.id;
      s.categoryId = category.id;
      s.categoryName = category.name;
      s.transactionDate = new Date().toISOString().split('T')[0];

      await ctx.answerCbQuery(s.month);
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return showUndoMessage(ctx, prisma, s, tx.id, `Aidat (${membership.user.fullName})`);
    }

    s.step = 'pickAmount';
    await ctx.answerCbQuery(s.month);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(
      `💰 ${s.associationName} — AİDAT\nÜye: ${s.membershipName}\nAy: ${s.month}\n\nTutarı girin:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Geri', 'fin:back_member')],
        [Markup.button.callback('❌ İptal', 'fin:cancel')],
      ]),
    );
  });

  bot.action(/^fin:(expense|donation|fee|summary|history|stats)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    const action = ctx.match[1] as FinanceAction;

    if (!s) { await ctx.answerCbQuery(); return startWizard(ctx, prisma, fromId, action); }

    s.action = action;
    touch(s);

    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);

    if (action === 'history') { s.step = 'idle'; return showHistory(ctx, prisma, s, 1); }
    if (action === 'stats') { s.step = 'idle'; return showMonthlyStats(ctx, prisma, s); }
    if (action === 'summary') {
      s.step = 'idle';
      if (!s.associationId) return ctx.reply('Dernek bilgisi eksik');
      const [inc, exp] = await prisma.$transaction([
        prisma.transaction.aggregate({ _sum: { amountInKurus: true }, where: { associationId: s.associationId, type: 'INCOME', deletedAt: null } }),
        prisma.transaction.aggregate({ _sum: { amountInKurus: true }, where: { associationId: s.associationId, type: 'EXPENSE', deletedAt: null } }),
      ]);
      return ctx.reply(
        `📊 ${s.associationName} Kasa\n\n💵 Gelir: ${kurusToTl(inc._sum.amountInKurus ?? 0)}\n💸 Gider: ${kurusToTl(exp._sum.amountInKurus ?? 0)}\n📈 Bakiye: ${kurusToTl((inc._sum.amountInKurus ?? 0) - (exp._sum.amountInKurus ?? 0))}`,
        Markup.inlineKeyboard([[Markup.button.callback('🔙 Ana Menü', 'fin:menu')]]),
      );
    }

    if (action === 'fee') { s.step = 'pickCategory'; return showCategoryPicker(ctx, prisma, s); }
    if (['expense', 'donation'].includes(action)) { s.step = 'pickAmount'; return showAmountPicker(ctx, s); }
    return showMainMenu(ctx);
  });

  // Bağış türü seçimi (indeksli — callback_data sınırı için). Seçilen tür adı
  // session'daki donationTypeOptions'dan çözülür; executeConfirm o ad için
  // kategoriyi getOrCreateCategory ile derneğe materyalize eder.
  bot.action(/^fin:dtype:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickCategory') {
      return ctx.answerCbQuery('Akış güncel değil');
    }
    const idx = parseInt(ctx.match[1], 10);
    const picked = s.donationTypeOptions?.[idx];
    if (!picked) return ctx.answerCbQuery('Geçersiz seçim');
    if (s.amountInKurus == null) {
      return ctx.answerCbQuery('Tutar bilgisi eksik', { show_alert: true });
    }

    s.categoryName = picked.name;
    s.categoryId = undefined;
    s.transactionDate =
      s.transactionDate ?? new Date().toISOString().split('T')[0];
    touch(s);

    await ctx.answerCbQuery(picked.name);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return executeConfirm(ctx, s, fromId);
  });

  bot.action(/^fin:cat:([^:]+):(.+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s || s.step !== 'pickCategory') return ctx.answerCbQuery('Akış güncel değil');

    s.categoryId = ctx.match[1];
    s.categoryName = ctx.match[2];
    s.lastUsedCategoryId = s.categoryId;

    if (s.amountInKurus != null) {
      s.transactionDate = new Date().toISOString().split('T')[0];
      const fromId = ctx.from!.id;
      await ctx.answerCbQuery(s.categoryName!);
      await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
      return executeConfirm(ctx, s, fromId);
    }

    const suggested = s.lastAmountByCategory?.[s.categoryId];
    const hint = suggested ? `\n💡 Son tutar: ${kurusToTl(suggested)}` : '\nTutarı girin:';

    s.step = 'pickAmount';
    touch(s);
    await ctx.answerCbQuery(s.categoryName!);
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return ctx.reply(`💰 ${s.categoryName}${hint}`, Markup.inlineKeyboard([
      [Markup.button.callback('🔙 Geri', 'fin:back_menu')],
      [Markup.button.callback('❌ İptal', 'fin:cancel')],
    ]));
  });

  bot.action(/^fin:history_page:(\d+)$/, async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const page = parseInt(ctx.match[1], 10);
    const s = sessions.get(fromId);
    if (!s || !s.associationId) {
      await ctx.answerCbQuery('Oturum sona erdi');
      return ctx.reply('Oturum sona erdi.', Markup.inlineKeyboard([[Markup.button.callback('🔙 Ana Menü', 'fin:menu')]]));
    }
    await ctx.answerCbQuery();
    await ctx.editMessageReplyMarkup(undefined).catch(() => undefined);
    return showHistory(ctx, prisma, s, page);
  });

  async function executeConfirm(ctx: Context, s: FinanceWizardSession, fromId: number) {
    const stillLinked = await assertAccountStillLinked(prisma, fromId);
    if (!stillLinked) {
      sessions.delete(fromId);
      return ctx.reply('Hesabın bağlı değil. /link ile bağla.');
    }

    try {
      const txDate = s.transactionDate ? new Date(s.transactionDate) : new Date();
      const category = await getOrCreateCategory(
        prisma,
        s.associationId!,
        s.action === 'fee' ? 'Aidat Geliri' : (s.action === 'donation' ? (s.categoryName || 'Genel') : (s.categoryName || 'Genel Gider')),
        s.action === 'expense' ? 'EXPENSE' : 'INCOME',
      );

      let description = s.description;
      if (s.action === 'fee' && s.membershipName && s.month) {
        description = `Aidat - ${s.month} - ${s.membershipName}`;
      }

      const tx = await prisma.transaction.create({
        data: {
          associationId: s.associationId!,
          categoryId: category.id,
          type: s.action === 'expense' ? 'EXPENSE' : 'INCOME',
          amountInKurus: s.amountInKurus!,
          description: description || (s.action === 'donation' ? 'Bağış' : 'İşlem'),
          transactionDate: txDate,
          createdById: s.userId,
        },
      });

      s.step = 'pending_undo';
      s.lastTransactionId = tx.id;
      s.categoryId = category.id;
      s.categoryName = category.name;
      touch(s);

      const label = s.action === 'expense' ? 'Gider' : s.action === 'donation' ? 'Bağış' : 'Aidat';
      return showUndoMessage(ctx, prisma, s, tx.id, label);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      sessions.delete(fromId);
      return ctx.reply(`❌ Kaydedilemedi: ${m}`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Ana Menü', 'fin:menu')]]));
    }
  }

  bot.action('fin:confirm', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s) return ctx.answerCbQuery('Akış güncel değil');
    return executeConfirm(ctx, s, fromId);
  });

  bot.action('fin:confirm_negative', async (ctx) => {
    const fromId = ctx.from?.id;
    if (!fromId) return ctx.answerCbQuery();
    const s = sessions.get(fromId);
    if (!s) return ctx.answerCbQuery('Akış güncel değil');
    s.confirmNegative = true;
    touch(s);
    return executeConfirm(ctx, s, fromId);
  });

  // -------------------------------------------------------------------------
  // FREE-TEXT INPUT
  // -------------------------------------------------------------------------

  bot.on('text', async (ctx, next) => {
    const fromId = ctx.from?.id;
    const text = ctx.message?.text;
    if (!fromId || !text || text.startsWith('/')) return next();

    const s = sessions.get(fromId);
    if (!s) return next();

    if (s.expiresAt <= Date.now()) {
      sessions.delete(fromId);
      return ctx.reply('Finans işlemi zaman aşımına uğradı. /finans yaz.');
    }

    try {
      if (s.step === 'pickAmount') {
        const amountStr = text.trim().replace(/,/g, '.');
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
          return ctx.reply('Geçersiz tutar. Tekrar girin (örn: 500 veya 500.50):', Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Geri', 'fin:back_menu')],
            [Markup.button.callback('❌ İptal', 'fin:cancel')],
          ]));
        }
        s.amountInKurus = Math.round(amount * 100);
        s.transactionDate = new Date().toISOString().split('T')[0];
        // Bağışta tutar girildikten sonra tür seçtir (henüz seçilmediyse).
        // Seçilmezse "Genel" varsayılanı kullanılır.
        if (s.action === 'donation' && !s.categoryName) {
          return showDonationTypePicker(ctx, prisma, s);
        }
        return executeConfirm(ctx, s, fromId);
      }
    } catch (err) {
      return ctx.reply(`❌ ${(err as Error).message}`, Markup.inlineKeyboard([[Markup.button.callback('🔙 Ana Menü', 'fin:menu')]]));
    }

    return next();
  });
}
