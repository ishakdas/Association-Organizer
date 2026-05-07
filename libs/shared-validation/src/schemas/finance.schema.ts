import { z } from 'zod';

export const transactionTypeEnum = z.enum(['INCOME', 'EXPENSE']);
export type TransactionTypeValue = z.infer<typeof transactionTypeEnum>;

export const feeFrequencyEnum = z.enum(['MONTHLY', 'YEARLY']);
export type FeeFrequencyValue = z.infer<typeof feeFrequencyEnum>;

const isoDateTime = z
  .string()
  .datetime({ offset: true, message: 'Geçerli bir tarih girin (ISO 8601)' });

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const createTransactionCategorySchema = z.object({
  name: z.string().min(1).max(100),
  type: transactionTypeEnum,
});
export type CreateTransactionCategoryInput = z.infer<typeof createTransactionCategorySchema>;

export const updateTransactionCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: transactionTypeEnum.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTransactionCategoryInput = z.infer<typeof updateTransactionCategorySchema>;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const createTransactionSchema = z.object({
  categoryId: z.string().cuid('Geçersiz kategori'),
  type: transactionTypeEnum,
  amountInKurus: z.number().int().min(1).max(100_000_000),
  description: z.string().max(500).optional(),
  transactionDate: isoDateTime.optional(),
  receiptUrl: z.string().url().max(2000).optional(),
  allowNegativeBalance: z.boolean().optional(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  type: transactionTypeEnum.optional(),
  categoryId: z.string().cuid().optional(),
  fromDate: isoDateTime.optional(),
  toDate: isoDateTime.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

// ---------------------------------------------------------------------------
// Event expense
// ---------------------------------------------------------------------------

export const recordEventExpenseSchema = z.object({
  expenseAmount: z.number().int().min(0),
  expenseNote: z.string().max(500).optional(),
  allowNegativeBalance: z.boolean().optional(),
});
export type RecordEventExpenseInput = z.infer<typeof recordEventExpenseSchema>;

// ---------------------------------------------------------------------------
// Fee payments
// ---------------------------------------------------------------------------

export const recordFeePaymentSchema = z.object({
  membershipId: z.string().cuid('Geçersiz üyelik'),
  amountInKurus: z.number().int().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-AA (örn: 2026-05)'),
  description: z.string().max(500).optional(),
});
export type RecordFeePaymentInput = z.infer<typeof recordFeePaymentSchema>;

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export const grantFinancePermissionSchema = z.object({
  userId: z.string().cuid('Geçersiz kullanıcı'),
});
export type GrantFinancePermissionInput = z.infer<typeof grantFinancePermissionSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const associationSettingsSchema = z.object({
  monthlyFeeAmountKurus: z.number().int().min(0).optional(),
  yearlyFeeAmountKurus: z.number().int().min(0).optional(),
  feeFrequency: feeFrequencyEnum,
});
export type AssociationSettingsInput = z.infer<typeof associationSettingsSchema>;

// ---------------------------------------------------------------------------
// Response schemas (for client/server contract)
// ---------------------------------------------------------------------------

export const transactionCategoryResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  name: z.string(),
  type: transactionTypeEnum,
  sortOrder: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type TransactionCategoryResponse = z.infer<typeof transactionCategoryResponseSchema>;

export const transactionResponseSchema = z.object({
  id: z.string(),
  associationId: z.string(),
  categoryId: z.string(),
  eventId: z.string().nullable(),
  type: transactionTypeEnum,
  amountInKurus: z.number(),
  description: z.string().nullable(),
  receiptUrl: z.string().nullable(),
  transactionDate: z.string(),
  createdById: z.string(),
  createdAt: z.string(),
});
export type TransactionResponse = z.infer<typeof transactionResponseSchema>;

export const financeSummarySchema = z.object({
  totalIncomeKurus: z.number(),
  totalExpenseKurus: z.number(),
  balanceKurus: z.number(),
  monthlyIncomeKurus: z.number(),
  monthlyExpenseKurus: z.number(),
  pendingFeesCount: z.number(),
});
export type FinanceSummaryResponse = z.infer<typeof financeSummarySchema>;

export const feePaymentResponseSchema = z.object({
  id: z.string(),
  membershipId: z.string(),
  memberName: z.string(),
  amountInKurus: z.number(),
  month: z.string(),
  paidAt: z.string(),
});
export type FeePaymentResponse = z.infer<typeof feePaymentResponseSchema>;

export const financePermissionResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  grantedAt: z.string(),
  isActive: z.boolean(),
});
export type FinancePermissionResponse = z.infer<typeof financePermissionResponseSchema>;
