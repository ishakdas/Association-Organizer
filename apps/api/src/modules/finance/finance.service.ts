import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, Prisma, UserRole, PermissionAction } from '@ticketbot/database';
import type {
  CreateTransactionInput,
  CreateTransactionCategoryInput,
  UpdateTransactionCategoryInput,
  ListTransactionsQuery,
  RecordEventExpenseInput,
  RecordFeePaymentInput,
  BulkFeePaymentInput,
  BulkFeePaymentResult,
  AssociationSettingsInput,
} from '@ticketbot/shared-validation';
import type { AuthenticatedUser } from '@ticketbot/shared-types';
import { PermissionService } from '../permissions/permission.service';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionService: PermissionService,
  ) {}

  // -------------------------------------------------------------------------
  // Authorization
  // -------------------------------------------------------------------------

  private async assertFinanceAccess(
    user: AuthenticatedUser,
    associationId: string,
  ): Promise<void> {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return;

    const hasRole = user.memberships.some(
      (m) =>
        m.isActive &&
        m.associationId === associationId &&
        (m.role === UserRole.ASSOCIATION_MANAGER ||
          m.role === UserRole.ASSOCIATION_SECRETARY),
    );
    if (hasRole) return;

    const hasPermission = await this.permissionService.hasPermission(
      user.id,
      associationId,
      PermissionAction.USE_FINANCE_COMMANDS,
    );
    if (hasPermission) return;

    throw new ForbiddenException('Finans işlemleri için yetkiniz yok');
  }

  private assertManagerAccess(
    user: AuthenticatedUser,
    associationId: string,
  ): void {
    if (user.systemRole === UserRole.SYSTEM_ADMIN) return;
    const isManager = user.memberships.some(
      (m) =>
        m.isActive &&
        m.associationId === associationId &&
        m.role === UserRole.ASSOCIATION_MANAGER,
    );
    if (!isManager) {
      throw new ForbiddenException('Bu işlem için yönetici yetkisi gerekli');
    }
  }

  // -------------------------------------------------------------------------
  // Categories
  // -------------------------------------------------------------------------

  async createCategory(
    associationId: string,
    input: CreateTransactionCategoryInput,
    user: AuthenticatedUser,
  ) {
    this.assertManagerAccess(user, associationId);

    const existing = await this.prisma.transactionCategory.findFirst({
      where: { associationId, name: input.name, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('Bu isimde bir kategori zaten var');
    }

    return this.prisma.transactionCategory.create({
      data: {
        associationId,
        name: input.name,
        type: input.type,
      },
    });
  }

  async listCategories(associationId: string, type?: string) {
    const where: Prisma.TransactionCategoryWhereInput = {
      associationId,
      deletedAt: null,
      isActive: true,
    };
    if (type) where.type = type as any;

    return this.prisma.transactionCategory.findMany({
      where,
      orderBy: [{ type: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async updateCategory(
    associationId: string,
    categoryId: string,
    input: UpdateTransactionCategoryInput,
    user: AuthenticatedUser,
  ) {
    this.assertManagerAccess(user, associationId);

    const category = await this.prisma.transactionCategory.findFirst({
      where: { id: categoryId, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı');

    return this.prisma.transactionCategory.update({
      where: { id: categoryId },
      data: {
        name: input.name ?? undefined,
        type: input.type ?? undefined,
        isActive: input.isActive ?? undefined,
      },
    });
  }

  async softDeleteCategory(
    associationId: string,
    categoryId: string,
    user: AuthenticatedUser,
  ) {
    this.assertManagerAccess(user, associationId);

    const category = await this.prisma.transactionCategory.findFirst({
      where: { id: categoryId, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı');

    // Kategoriye bağlı işlem var mı?
    const hasTransactions = await this.prisma.transaction.findFirst({
      where: { categoryId, deletedAt: null },
      select: { id: true },
    });
    if (hasTransactions) {
      throw new BadRequestException(
        'Bu kategoriye ait işlemler var, önce silin veya taşının',
      );
    }

    return this.prisma.transactionCategory.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------

  private async getCurrentBalance(associationId: string): Promise<number> {
    const [incomeAgg, expenseAgg] = await this.prisma.$transaction([
      this.prisma.transaction.aggregate({
        where: { associationId, type: 'INCOME', deletedAt: null },
        _sum: { amountInKurus: true },
      }),
      this.prisma.transaction.aggregate({
        where: { associationId, type: 'EXPENSE', deletedAt: null },
        _sum: { amountInKurus: true },
      }),
    ]);
    return (incomeAgg._sum.amountInKurus ?? 0) - (expenseAgg._sum.amountInKurus ?? 0);
  }

  private assertSufficientBalance(
    balanceKurus: number,
    amountInKurus: number,
    allowNegativeBalance: boolean | undefined,
  ): void {
    if (balanceKurus < amountInKurus && !allowNegativeBalance) {
      const balanceTl = (balanceKurus / 100).toFixed(2);
      const deficitTl = ((amountInKurus - balanceKurus) / 100).toFixed(2);
      throw new BadRequestException(
        `Kasa bakiyesi ${balanceTl} TL. Bu işlem sonrası bakiye -${deficitTl} TL olacak. ` +
          `Yine de devam etmek istiyorsanız allowNegativeBalance=true gönderin.`,
      );
    }
  }

  async createTransaction(
    associationId: string,
    input: CreateTransactionInput,
    user: AuthenticatedUser,
  ) {
    await this.assertFinanceAccess(user, associationId);

    const category = await this.prisma.transactionCategory.findFirst({
      where: {
        id: input.categoryId,
        associationId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, type: true },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı');

    if (category.type !== input.type) {
      throw new BadRequestException(
        `Kategori tipi (${category.type}) işlem tipi (${input.type}) ile uyuşmuyor`,
      );
    }

    if (input.type === 'EXPENSE') {
      const balance = await this.getCurrentBalance(associationId);
      this.assertSufficientBalance(balance, input.amountInKurus, input.allowNegativeBalance);
    }

    return this.prisma.transaction.create({
      data: {
        associationId,
        categoryId: input.categoryId,
        type: input.type,
        amountInKurus: input.amountInKurus,
        description: input.description ?? null,
        transactionDate: input.transactionDate
          ? new Date(input.transactionDate)
          : new Date(),
        receiptUrl: input.receiptUrl ?? null,
        createdById: user.id,
      },
    });
  }

  async listTransactions(
    associationId: string,
    query: ListTransactionsQuery,
  ) {
    const where: Prisma.TransactionWhereInput = {
      associationId,
      deletedAt: null,
    };
    if (query.type) where.type = query.type;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.fromDate || query.toDate) {
      where.transactionDate = {};
      if (query.fromDate) where.transactionDate.gte = new Date(query.fromDate);
      if (query.toDate) where.transactionDate.lte = new Date(query.toDate);
    }

    const { page, pageSize } = query;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { transactionDate: 'desc' },
        include: {
          category: { select: { id: true, name: true, type: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        ...r,
        amountInKurus: r.amountInKurus,
        transactionDate: r.transactionDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  async softDeleteTransaction(
    associationId: string,
    transactionId: string,
    user: AuthenticatedUser,
  ) {
    // Sadece MANAGER silebilir
    this.assertManagerAccess(user, associationId);

    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, associationId, deletedAt: null },
      select: { id: true },
    });
    if (!tx) throw new NotFoundException('İşlem bulunamadı');

    return this.prisma.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date() },
    });
  }

  // -------------------------------------------------------------------------
  // Event expense integration
  // -------------------------------------------------------------------------

  async recordEventExpense(
    associationId: string,
    eventId: string,
    input: RecordEventExpenseInput,
    user: AuthenticatedUser,
  ) {
    await this.assertFinanceAccess(user, associationId);

    if (input.expenseAmount > 0) {
      const balance = await this.getCurrentBalance(associationId);
      this.assertSufficientBalance(balance, input.expenseAmount, input.allowNegativeBalance);
    }

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.update({
        where: { id: eventId, associationId, deletedAt: null },
        data: {
          expenseAmount: input.expenseAmount,
          expenseNote: input.expenseNote ?? null,
        },
      });

      if (input.expenseAmount > 0) {
        let category = await tx.transactionCategory.findFirst({
          where: {
            associationId,
            name: 'Etkinlik Gideri',
            type: 'EXPENSE',
            deletedAt: null,
          },
        });
        if (!category) {
          category = await tx.transactionCategory.create({
            data: {
              associationId,
              name: 'Etkinlik Gideri',
              type: 'EXPENSE',
            },
          });
        }

        await tx.transaction.create({
          data: {
            associationId,
            categoryId: category.id,
            eventId,
            type: 'EXPENSE',
            amountInKurus: input.expenseAmount,
            description: input.expenseNote || `${event.title} etkinlik harcaması`,
            createdById: user.id,
          },
        });
      }

      return event;
    });
  }

  // -------------------------------------------------------------------------
  // Fee payments
  // -------------------------------------------------------------------------

  async recordFeePayment(
    associationId: string,
    input: RecordFeePaymentInput,
    user: AuthenticatedUser,
  ) {
    await this.assertFinanceAccess(user, associationId);

    const membership = await this.prisma.associationMembership.findFirst({
      where: {
        id: input.membershipId,
        associationId,
        isActive: true,
        deletedAt: null,
      },
      include: { user: { select: { id: true, fullName: true } } },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    const [year, month] = input.month.split('-').map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Aynı üye için aynı ayda çift kayıt önleme
    const existing = await this.prisma.transaction.findFirst({
      where: {
        associationId,
        type: 'INCOME',
        createdById: user.id,
        transactionDate: { gte: periodStart, lte: periodEnd },
        description: { startsWith: `Aidat - ${input.month}` },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `${input.month} ayı için bu üyeye ait aidat kaydı zaten var`,
      );
    }

    let category = await this.prisma.transactionCategory.findFirst({
      where: {
        associationId,
        name: 'Aidat Geliri',
        type: 'INCOME',
        deletedAt: null,
      },
    });
    if (!category) {
      category = await this.prisma.transactionCategory.create({
        data: {
          associationId,
          name: 'Aidat Geliri',
          type: 'INCOME',
        },
      });
    }

    return this.prisma.transaction.create({
      data: {
        associationId,
        categoryId: category.id,
        type: 'INCOME',
        amountInKurus: input.amountInKurus,
        description:
          input.description ||
          `Aidat - ${input.month} - ${membership.user.fullName}`,
        transactionDate: new Date(),
        createdById: user.id,
      },
    });
  }

  async getMemberFeeHistory(associationId: string, membershipId: string) {
    const membership = await this.prisma.associationMembership.findFirst({
      where: {
        id: membershipId,
        associationId,
        isActive: true,
        deletedAt: null,
      },
      include: { user: { select: { id: true, fullName: true } } },
    });
    if (!membership) throw new NotFoundException('Üyelik bulunamadı');

    const rows = await this.prisma.transaction.findMany({
      where: {
        associationId,
        type: 'INCOME',
        deletedAt: null,
        description: { contains: membership.user.fullName },
      },
      orderBy: { transactionDate: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return {
      member: membership.user,
      payments: rows.map((r) => ({
        id: r.id,
        amountInKurus: r.amountInKurus,
        description: r.description,
        transactionDate: r.transactionDate.toISOString(),
      })),
    };
  }

  async listFeePayments(associationId: string) {
    const rows = await this.prisma.transaction.findMany({
      where: {
        associationId,
        type: 'INCOME',
        deletedAt: null,
        description: { startsWith: 'Aidat -' },
      },
      orderBy: { transactionDate: 'desc' },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return rows.map((r) => {
      const match = r.description?.match(/^Aidat - (\d{4}-\d{2}) - (.+)$/);
      return {
        id: r.id,
        amountInKurus: r.amountInKurus,
        month: match?.[1] ?? '',
        memberName: match?.[2] ?? '',
        description: r.description,
        paidAt: r.transactionDate.toISOString(),
      };
    });
  }

  async bulkFeePayment(
    associationId: string,
    input: BulkFeePaymentInput,
    user: AuthenticatedUser,
  ): Promise<BulkFeePaymentResult> {
    await this.assertFinanceAccess(user, associationId);

    const result: BulkFeePaymentResult = {
      successCount: 0,
      skippedCount: 0,
      skipped: [],
      totalAmountKurus: 0,
    };

    const createdTransactions: Array<{
      associationId: string;
      categoryId: string;
      type: 'INCOME';
      amountInKurus: number;
      description: string;
      transactionDate: Date;
      createdById: string;
    }> = [];

    let category = await this.prisma.transactionCategory.findFirst({
      where: {
        associationId,
        name: 'Aidat Geliri',
        type: 'INCOME',
        deletedAt: null,
      },
    });
    if (!category) {
      category = await this.prisma.transactionCategory.create({
        data: {
          associationId,
          name: 'Aidat Geliri',
          type: 'INCOME',
        },
      });
    }

    for (const payment of input.payments) {
      const membership = await this.prisma.associationMembership.findFirst({
        where: {
          id: payment.membershipId,
          associationId,
          isActive: true,
          deletedAt: null,
        },
        include: { user: { select: { id: true, fullName: true } } },
      });

      if (!membership) {
        result.skippedCount++;
        result.skipped.push({
          membershipId: payment.membershipId,
          memberName: 'Bilinmeyen',
          month: payment.month,
          reason: 'Üyelik bulunamadı veya aktif değil',
        });
        continue;
      }

      const [year, month] = payment.month.split('-').map(Number);
      const periodStart = new Date(year, month - 1, 1);
      const periodEnd = new Date(year, month, 0, 23, 59, 59);

      const existing = await this.prisma.transaction.findFirst({
        where: {
          associationId,
          type: 'INCOME',
          createdById: user.id,
          transactionDate: { gte: periodStart, lte: periodEnd },
          description: { startsWith: `Aidat - ${payment.month}` },
        },
      });

      if (existing) {
        result.skippedCount++;
        result.skipped.push({
          membershipId: payment.membershipId,
          memberName: membership.user.fullName,
          month: payment.month,
          reason: 'Bu ay için zaten kayıt var',
        });
        continue;
      }

      createdTransactions.push({
        associationId,
        categoryId: category.id,
        type: 'INCOME',
        amountInKurus: payment.amountInKurus,
        description:
          payment.description ||
          `Aidat - ${payment.month} - ${membership.user.fullName}`,
        transactionDate: new Date(),
        createdById: user.id,
      });
    }

    if (createdTransactions.length > 0) {
      await this.prisma.transaction.createMany({
        data: createdTransactions,
      });
    }

    result.successCount = createdTransactions.length;
    result.totalAmountKurus = createdTransactions.reduce(
      (sum, t) => sum + t.amountInKurus,
      0,
    );

    return result;
  }

  async getUnpaidMembers(associationId: string, month: string) {
    const [year, monthNum] = month.split('-').map(Number);
    const periodStart = new Date(year, monthNum - 1, 1);
    const periodEnd = new Date(year, monthNum, 0, 23, 59, 59);

    const activeMembers = await this.prisma.associationMembership.findMany({
      where: {
        associationId,
        isActive: true,
        deletedAt: null,
      },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { user: { fullName: 'asc' } },
    });

    const paidDescriptions = await this.prisma.transaction.findMany({
      where: {
        associationId,
        type: 'INCOME',
        deletedAt: null,
        transactionDate: { gte: periodStart, lte: periodEnd },
        description: { startsWith: `Aidat - ${month}` },
      },
      select: { description: true },
    });

    const paidMemberNames = new Set(
      paidDescriptions
        .map((t) => t.description?.match(/^Aidat - \d{4}-\d{2} - (.+)$/)?.[1])
        .filter(Boolean),
    );

    const settings = await this.prisma.associationSettings.findUnique({
      where: { associationId },
      select: { monthlyFeeAmountKurus: true },
    });

    return activeMembers.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      fullName: m.user.fullName,
      hasPaid: paidMemberNames.has(m.user.fullName),
      monthlyFeeAmountKurus: settings?.monthlyFeeAmountKurus ?? null,
    }));
  }

  // -------------------------------------------------------------------------
  // Donations
  // -------------------------------------------------------------------------

  async recordDonation(
    associationId: string,
    amountInKurus: number,
    description: string | null,
    user: AuthenticatedUser,
  ) {
    await this.assertFinanceAccess(user, associationId);

    // "Genel" is the default donation type when none is selected (matches the
    // bot /bagis quick path and the global donation-category catalog default).
    let category = await this.prisma.transactionCategory.findFirst({
      where: {
        associationId,
        name: 'Genel',
        type: 'INCOME',
        deletedAt: null,
      },
    });
    if (!category) {
      category = await this.prisma.transactionCategory.create({
        data: {
          associationId,
          name: 'Genel',
          type: 'INCOME',
        },
      });
    }

    return this.prisma.transaction.create({
      data: {
        associationId,
        categoryId: category.id,
        type: 'INCOME',
        amountInKurus,
        description: description || 'Anonim bağış',
        createdById: user.id,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Summary & Reports
  // -------------------------------------------------------------------------

  async getSummary(associationId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [allIncome, allExpense, monthIncome, monthExpense] =
      await this.prisma.$transaction([
        this.prisma.transaction.aggregate({
          where: { associationId, type: 'INCOME', deletedAt: null },
          _sum: { amountInKurus: true },
        }),
        this.prisma.transaction.aggregate({
          where: { associationId, type: 'EXPENSE', deletedAt: null },
          _sum: { amountInKurus: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            associationId,
            type: 'INCOME',
            deletedAt: null,
            transactionDate: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amountInKurus: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            associationId,
            type: 'EXPENSE',
            deletedAt: null,
            transactionDate: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amountInKurus: true },
        }),
      ]);

    const totalIncomeKurus = allIncome._sum.amountInKurus ?? 0;
    const totalExpenseKurus = allExpense._sum.amountInKurus ?? 0;

    return {
      totalIncomeKurus,
      totalExpenseKurus,
      balanceKurus: totalIncomeKurus - totalExpenseKurus,
      monthlyIncomeKurus: monthIncome._sum.amountInKurus ?? 0,
      monthlyExpenseKurus: monthExpense._sum.amountInKurus ?? 0,
    };
  }

  async getMonthlyStats(associationId: string) {
    const now = new Date();
    const months: { label: string; incomeKurus: number; expenseKurus: number }[] = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const label = d.toLocaleDateString('tr-TR', { year: 'numeric', month: 'long' });

      const [incomeAgg, expenseAgg] = await this.prisma.$transaction([
        this.prisma.transaction.aggregate({
          where: {
            associationId,
            type: 'INCOME',
            deletedAt: null,
            transactionDate: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amountInKurus: true },
        }),
        this.prisma.transaction.aggregate({
          where: {
            associationId,
            type: 'EXPENSE',
            deletedAt: null,
            transactionDate: { gte: monthStart, lte: monthEnd },
          },
          _sum: { amountInKurus: true },
        }),
      ]);

      months.push({
        label,
        incomeKurus: incomeAgg._sum.amountInKurus ?? 0,
        expenseKurus: expenseAgg._sum.amountInKurus ?? 0,
      });
    }

    return months;
  }

  async getReport(associationId: string, fromDate?: string, toDate?: string) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate);

    const categories = await this.prisma.transactionCategory.findMany({
      where: { associationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, type: true },
    });

    const report = await Promise.all(
      categories.map(async (cat) => {
        const agg = await this.prisma.transaction.aggregate({
          where: {
            associationId,
            categoryId: cat.id,
            deletedAt: null,
            ...(Object.keys(dateFilter).length > 0
              ? { transactionDate: dateFilter }
              : {}),
          },
          _sum: { amountInKurus: true },
          _count: { id: true },
        });
        return {
          categoryId: cat.id,
          categoryName: cat.name,
          type: cat.type,
          totalAmountKurus: agg._sum.amountInKurus ?? 0,
          transactionCount: agg._count.id,
        };
      }),
    );

    return report.filter((r) => r.totalAmountKurus > 0);
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  async updateSettings(
    associationId: string,
    input: AssociationSettingsInput,
    user: AuthenticatedUser,
  ) {
    this.assertManagerAccess(user, associationId);

    return this.prisma.associationSettings.upsert({
      where: { associationId },
      update: {
        monthlyFeeAmountKurus: input.monthlyFeeAmountKurus ?? null,
        yearlyFeeAmountKurus: input.yearlyFeeAmountKurus ?? null,
        feeFrequency: input.feeFrequency,
      },
      create: {
        associationId,
        monthlyFeeAmountKurus: input.monthlyFeeAmountKurus ?? null,
        yearlyFeeAmountKurus: input.yearlyFeeAmountKurus ?? null,
        feeFrequency: input.feeFrequency,
      },
    });
  }

  async getSettings(associationId: string) {
    return this.prisma.associationSettings.findUnique({
      where: { associationId },
    });
  }

  // -------------------------------------------------------------------------
  // Bot helpers
  // -------------------------------------------------------------------------

  async findCategoriesForBot(
    associationId: string,
    type: 'INCOME' | 'EXPENSE',
  ) {
    return this.prisma.transactionCategory.findMany({
      where: { associationId, type, deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async createTransactionFromBot(
    associationId: string,
    type: 'INCOME' | 'EXPENSE',
    categoryId: string,
    amountInKurus: number,
    description: string | null,
    userId: string,
  ) {
    return this.prisma.transaction.create({
      data: {
        associationId,
        categoryId,
        type,
        amountInKurus,
        description: description ?? null,
        createdById: userId,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Frequent categories (sık kullanılan kategoriler)
  // -------------------------------------------------------------------------

  async getFrequentCategories(associationId: string, limit = 5) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const frequentCategories = await this.prisma.transactionCategory.findMany({
      where: {
        associationId,
        deletedAt: null,
        isActive: true,
        transactions: {
          some: {
            deletedAt: null,
            transactionDate: { gte: thirtyDaysAgo },
          },
        },
      },
      select: {
        id: true,
        name: true,
        type: true,
        _count: {
          select: {
            transactions: {
              where: {
                deletedAt: null,
                transactionDate: { gte: thirtyDaysAgo },
              },
            },
          },
        },
      },
      orderBy: {
        transactions: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return frequentCategories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      count: cat._count.transactions,
    }));
  }
}
