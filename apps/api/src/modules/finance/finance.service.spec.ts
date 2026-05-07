import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { FinanceService } from './finance.service';

type PrismaMock = DeepMockProxy<PrismaClient>;

const ASSOC = 'assoc-1';
const MANAGER = {
  id: 'mgr-1',
  systemRole: null,
  memberships: [{ id: 'mem-mgr', associationId: ASSOC, role: 'ASSOCIATION_MANAGER', isActive: true }],
} as any;
const SECRETARY = {
  id: 'sec-1',
  systemRole: null,
  memberships: [{ id: 'mem-sec', associationId: ASSOC, role: 'ASSOCIATION_SECRETARY', isActive: true }],
} as any;
const MEMBER = {
  id: 'mem-1',
  systemRole: null,
  memberships: [{ id: 'mem-mem', associationId: ASSOC, role: 'ASSOCIATION_MEMBER', isActive: true }],
} as any;
const FINANCE_PERM_USER = {
  id: 'fin-1',
  systemRole: null,
  memberships: [{ id: 'mem-fin', associationId: ASSOC, role: 'ASSOCIATION_MEMBER', isActive: true }],
} as any;

describe('FinanceService', () => {
  let service: FinanceService;
  let prisma: PrismaMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    prisma.$transaction.mockImplementation(async (input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(prisma);
    });

    const module = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  describe('createCategory', () => {
    it('creates a category when manager', async () => {
      prisma.transactionCategory.findFirst.mockResolvedValue(null as never);
      prisma.transactionCategory.create.mockResolvedValue({
        id: 'cat-1', associationId: ASSOC, name: 'Kira', type: 'EXPENSE',
      } as never);

      const result = await service.createCategory(ASSOC, { name: 'Kira', type: 'EXPENSE' }, MANAGER);
      expect(result.name).toBe('Kira');
    });

    it('throws ForbiddenException for member without finance permission', async () => {
      await expect(
        service.createCategory(ASSOC, { name: 'Kira', type: 'EXPENSE' }, MEMBER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ---------------------------------------------------------------------------
  // Transactions
  // ---------------------------------------------------------------------------

  describe('createTransaction', () => {
    it('creates income transaction for secretary', async () => {
      prisma.transactionCategory.findFirst.mockResolvedValue({
        id: 'cat-1', type: 'INCOME',
      } as never);
      prisma.transaction.create.mockResolvedValue({
        id: 'tx-1', amountInKurus: 10000, type: 'INCOME',
      } as never);

      const result = await service.createTransaction(ASSOC, {
        categoryId: 'cat-1', type: 'INCOME', amountInKurus: 10000,
      }, SECRETARY);

      expect(result.amountInKurus).toBe(10000);
    });

    it('creates transaction for finance permission user', async () => {
      prisma.financePermission.findFirst.mockResolvedValue({
        id: 'perm-1', associationId: ASSOC, userId: FINANCE_PERM_USER.id, isActive: true,
      } as never);
      prisma.transactionCategory.findFirst.mockResolvedValue({
        id: 'cat-1', type: 'EXPENSE',
      } as never);
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountInKurus: 100000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 50000 } } as never);
      prisma.transaction.create.mockResolvedValue({
        id: 'tx-1', amountInKurus: 5000, type: 'EXPENSE',
      } as never);

      const result = await service.createTransaction(ASSOC, {
        categoryId: 'cat-1', type: 'EXPENSE', amountInKurus: 5000,
      }, FINANCE_PERM_USER);

      expect(result.amountInKurus).toBe(5000);
    });

    it('throws BadRequestException when balance insufficient', async () => {
      prisma.transactionCategory.findFirst.mockResolvedValue({
        id: 'cat-1', type: 'EXPENSE',
      } as never);
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountInKurus: 10000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 8000 } } as never);

      await expect(
        service.createTransaction(ASSOC, {
          categoryId: 'cat-1', type: 'EXPENSE', amountInKurus: 5000,
        }, MANAGER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows negative balance when explicitly requested', async () => {
      prisma.transactionCategory.findFirst.mockResolvedValue({
        id: 'cat-1', type: 'EXPENSE',
      } as never);
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountInKurus: 10000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 8000 } } as never);
      prisma.transaction.create.mockResolvedValue({
        id: 'tx-1', amountInKurus: 5000, type: 'EXPENSE',
      } as never);

      const result = await service.createTransaction(ASSOC, {
        categoryId: 'cat-1', type: 'EXPENSE', amountInKurus: 5000, allowNegativeBalance: true,
      }, MANAGER);

      expect(result.amountInKurus).toBe(5000);
    });
  });

  // ---------------------------------------------------------------------------
  // Permissions
  // ---------------------------------------------------------------------------

  describe('grantPermission', () => {
    it('grants permission to a member', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue({ id: 'mem-1' } as never);
      prisma.financePermission.findFirst.mockResolvedValue(null as never);
      prisma.financePermission.create.mockResolvedValue({
        id: 'perm-1', userId: MEMBER.id, associationId: ASSOC, isActive: true,
      } as never);

      const result = await service.grantPermission(ASSOC, MEMBER.id, MANAGER);
      expect(result.isActive).toBe(true);
    });

    it('throws BadRequestException if user is not a member', async () => {
      prisma.associationMembership.findFirst.mockResolvedValue(null as never);

      await expect(
        service.grantPermission(ASSOC, 'non-member', MANAGER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('revokePermission', () => {
    it('revokes active permission', async () => {
      prisma.financePermission.findFirst.mockResolvedValue({
        id: 'perm-1', isActive: true,
      } as never);
      prisma.financePermission.update.mockResolvedValue({
        id: 'perm-1', isActive: false,
      } as never);

      const result = await service.revokePermission(ASSOC, MEMBER.id, MANAGER);
      expect(result.isActive).toBe(false);
    });

    it('throws NotFoundException if no active permission', async () => {
      prisma.financePermission.findFirst.mockResolvedValue(null as never);

      await expect(
        service.revokePermission(ASSOC, MEMBER.id, MANAGER),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------

  describe('getSummary', () => {
    it('returns correct balance', async () => {
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountInKurus: 50000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 20000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 30000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 10000 } } as never);

      const result = await service.getSummary(ASSOC);
      expect(result.totalIncomeKurus).toBe(50000);
      expect(result.totalExpenseKurus).toBe(20000);
      expect(result.balanceKurus).toBe(30000);
    });
  });

  // ---------------------------------------------------------------------------
  // Event expense
  // ---------------------------------------------------------------------------

  describe('recordEventExpense', () => {
    it('records expense and creates transaction', async () => {
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountInKurus: 50000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 20000 } } as never);
      prisma.event.update.mockResolvedValue({
        id: 'evt-1', title: 'İftar', expenseAmount: 15000, expenseNote: 'Yemek',
      } as never);
      prisma.transactionCategory.findFirst.mockResolvedValue(null as never);
      prisma.transactionCategory.create.mockResolvedValue({
        id: 'cat-exp', name: 'Etkinlik Gideri', type: 'EXPENSE',
      } as never);
      prisma.transaction.create.mockResolvedValue({ id: 'tx-1' } as never);

      const result = await service.recordEventExpense(ASSOC, 'evt-1', {
        expenseAmount: 15000, expenseNote: 'Yemek',
      }, MANAGER);

      expect(result.expenseAmount).toBe(15000);
    });

    it('throws BadRequestException when balance insufficient for event expense', async () => {
      prisma.transaction.aggregate
        .mockResolvedValueOnce({ _sum: { amountInKurus: 10000 } } as never)
        .mockResolvedValueOnce({ _sum: { amountInKurus: 8000 } } as never);

      await expect(
        service.recordEventExpense(ASSOC, 'evt-1', {
          expenseAmount: 5000, expenseNote: 'Yemek',
        }, MANAGER),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
