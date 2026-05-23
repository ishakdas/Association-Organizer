import { Test } from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient, PrismaService } from '@ticketbot/database';
import { FinanceService } from './finance.service';
import { PermissionService } from '../permissions/permission.service';

type PrismaMock = DeepMockProxy<PrismaClient>;
type PermissionServiceMock = DeepMockProxy<PermissionService>;

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
  let permissionService: PermissionServiceMock;

  beforeEach(async () => {
    prisma = mockDeep<PrismaClient>();
    permissionService = mockDeep<PermissionService>();

    prisma.$transaction.mockImplementation(async (input: any) => {
      if (Array.isArray(input)) return Promise.all(input);
      return input(prisma);
    });

    permissionService.hasPermission.mockResolvedValue(true);

    const module = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: PermissionService, useValue: permissionService },
      ],
    }).compile();

    service = module.get<FinanceService>(FinanceService);
  });

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
      permissionService.hasPermission.mockResolvedValue(false);

      await expect(
        service.createCategory(ASSOC, { name: 'Kira', type: 'EXPENSE' }, MEMBER),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

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
      permissionService.hasPermission.mockResolvedValue(true);
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

  describe('bulkFeePayment', () => {
    it('creates multiple fee payments and returns result', async () => {
      permissionService.hasPermission.mockResolvedValue(true);
      prisma.transactionCategory.findFirst.mockResolvedValue({
        id: 'cat-aidat', name: 'Aidat Geliri', type: 'INCOME',
      } as never);
      prisma.associationMembership.findFirst
        .mockResolvedValueOnce({
          id: 'mem-1', user: { id: 'u1', fullName: 'Ahmet Yılmaz' },
        } as never)
        .mockResolvedValueOnce({
          id: 'mem-2', user: { id: 'u2', fullName: 'Fatma Demir' },
        } as never);
      prisma.transaction.findFirst.mockResolvedValue(null as never);
      prisma.transaction.createMany.mockResolvedValue({ count: 2 } as never);

      const result = await service.bulkFeePayment(ASSOC, {
        payments: [
          { membershipId: 'mem-1', amountInKurus: 50000, month: '2026-05' },
          { membershipId: 'mem-2', amountInKurus: 50000, month: '2026-05' },
        ],
      }, MANAGER);

      expect(result.successCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.totalAmountKurus).toBe(100000);
    });

    it('skips duplicate payments for same month', async () => {
      permissionService.hasPermission.mockResolvedValue(true);
      prisma.transactionCategory.findFirst.mockResolvedValue({
        id: 'cat-aidat', name: 'Aidat Geliri', type: 'INCOME',
      } as never);
      prisma.associationMembership.findFirst.mockResolvedValue({
        id: 'mem-1', user: { id: 'u1', fullName: 'Ahmet Yılmaz' },
      } as never);
      prisma.transaction.findFirst.mockResolvedValue({ id: 'existing-tx' } as never);

      const result = await service.bulkFeePayment(ASSOC, {
        payments: [
          { membershipId: 'mem-1', amountInKurus: 50000, month: '2026-05' },
        ],
      }, MANAGER);

      expect(result.successCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.skipped[0].reason).toBe('Bu ay için zaten kayıt var');
    });

    it('skips inactive memberships', async () => {
      permissionService.hasPermission.mockResolvedValue(true);
      prisma.transactionCategory.findFirst.mockResolvedValue({
        id: 'cat-aidat', name: 'Aidat Geliri', type: 'INCOME',
      } as never);
      prisma.associationMembership.findFirst.mockResolvedValue(null as never);

      const result = await service.bulkFeePayment(ASSOC, {
        payments: [
          { membershipId: 'mem-inactive', amountInKurus: 50000, month: '2026-05' },
        ],
      }, MANAGER);

      expect(result.successCount).toBe(0);
      expect(result.skippedCount).toBe(1);
      expect(result.skipped[0].reason).toBe('Üyelik bulunamadı veya aktif değil');
    });
  });

  describe('getUnpaidMembers', () => {
    it('returns all members with paid/unpaid status', async () => {
      prisma.associationMembership.findMany.mockResolvedValue([
        { id: 'mem-1', user: { id: 'u1', fullName: 'Ahmet Yılmaz' } },
        { id: 'mem-2', user: { id: 'u2', fullName: 'Fatma Demir' } },
      ] as never);
      prisma.transaction.findMany.mockResolvedValue([
        { description: 'Aidat - 2026-05 - Ahmet Yılmaz' },
      ] as never);
      prisma.associationSettings.findUnique.mockResolvedValue({
        monthlyFeeAmountKurus: 50000,
      } as never);

      const result = await service.getUnpaidMembers(ASSOC, '2026-05');

      expect(result).toHaveLength(2);
      expect(result[0].hasPaid).toBe(true);
      expect(result[0].fullName).toBe('Ahmet Yılmaz');
      expect(result[1].hasPaid).toBe(false);
      expect(result[1].fullName).toBe('Fatma Demir');
      expect(result[0].monthlyFeeAmountKurus).toBe(50000);
    });
  });

  describe('getFrequentCategories', () => {
    it('returns most used categories from last 30 days', async () => {
      prisma.transactionCategory.findMany.mockResolvedValue([
        {
          id: 'cat-1', name: 'Kira', type: 'EXPENSE',
          _count: { transactions: 5 },
        },
        {
          id: 'cat-2', name: 'Fatura', type: 'EXPENSE',
          _count: { transactions: 3 },
        },
      ] as never);

      const result = await service.getFrequentCategories(ASSOC, 5);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Kira');
      expect(result[0].count).toBe(5);
      expect(result[1].name).toBe('Fatura');
      expect(result[1].count).toBe(3);
    });
  });
});
