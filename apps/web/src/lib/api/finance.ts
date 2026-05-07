import { apiClient } from './client';
import type {
  CreateTransactionInput,
  CreateTransactionCategoryInput,
  FinanceSummaryResponse,
  TransactionResponse,
  TransactionCategoryResponse,
  ListTransactionsQuery,
  AssociationSettingsInput,
  GrantFinancePermissionInput,
} from '@ticketbot/shared-validation';

export function getFinanceSummary(token: string, associationId: string) {
  return apiClient<FinanceSummaryResponse>(
    `/associations/${associationId}/finance/summary`,
    { token },
  );
}

export function getMonthlyStats(token: string, associationId: string) {
  return apiClient<Array<{ label: string; incomeKurus: number; expenseKurus: number }>>(
    `/associations/${associationId}/finance/monthly-stats`,
    { token },
  );
}

export function listTransactions(
  token: string,
  associationId: string,
  params: ListTransactionsQuery,
) {
  const sp = new URLSearchParams();
  if (params.type) sp.set('type', params.type);
  if (params.categoryId) sp.set('categoryId', params.categoryId);
  if (params.fromDate) sp.set('fromDate', params.fromDate);
  if (params.toDate) sp.set('toDate', params.toDate);
  if (params.page) sp.set('page', String(params.page));
  if (params.pageSize) sp.set('pageSize', String(params.pageSize));
  const q = sp.toString();
  return apiClient<{ data: TransactionResponse[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }>(
    `/associations/${associationId}/finance/transactions${q ? `?${q}` : ''}`,
    { token },
  );
}

export function createTransaction(
  token: string,
  associationId: string,
  data: CreateTransactionInput,
) {
  return apiClient<TransactionResponse>(
    `/associations/${associationId}/finance/transactions`,
    { token, method: 'POST', body: JSON.stringify(data) },
  );
}

export function deleteTransaction(
  token: string,
  associationId: string,
  transactionId: string,
) {
  return apiClient<void>(
    `/associations/${associationId}/finance/transactions/${transactionId}`,
    { token, method: 'DELETE' },
  );
}

export function listCategories(token: string, associationId: string, type?: string) {
  const q = type ? `?type=${type}` : '';
  return apiClient<TransactionCategoryResponse[]>(
    `/associations/${associationId}/finance/categories${q}`,
    { token },
  );
}

export function createCategory(
  token: string,
  associationId: string,
  data: CreateTransactionCategoryInput,
) {
  return apiClient<TransactionCategoryResponse>(
    `/associations/${associationId}/finance/categories`,
    { token, method: 'POST', body: JSON.stringify(data) },
  );
}

export function deleteCategory(
  token: string,
  associationId: string,
  categoryId: string,
) {
  return apiClient<void>(
    `/associations/${associationId}/finance/categories/${categoryId}`,
    { token, method: 'DELETE' },
  );
}

export function recordDonation(
  token: string,
  associationId: string,
  amountInKurus: number,
  description?: string,
) {
  return apiClient<TransactionResponse>(
    `/associations/${associationId}/finance/donations`,
    { token, method: 'POST', body: JSON.stringify({ amountInKurus, description }) },
  );
}

export function getSettings(token: string, associationId: string) {
  return apiClient<{ monthlyFeeAmountKurus: number | null; yearlyFeeAmountKurus: number | null; feeFrequency: string }>(
    `/associations/${associationId}/finance/settings`,
    { token },
  );
}

export function updateSettings(
  token: string,
  associationId: string,
  data: AssociationSettingsInput,
) {
  return apiClient<void>(
    `/associations/${associationId}/finance/settings`,
    { token, method: 'PUT', body: JSON.stringify(data) },
  );
}

export function grantPermission(
  token: string,
  associationId: string,
  data: GrantFinancePermissionInput,
) {
  return apiClient<void>(
    `/associations/${associationId}/finance/permissions`,
    { token, method: 'POST', body: JSON.stringify(data) },
  );
}

export function revokePermission(
  token: string,
  associationId: string,
  userId: string,
) {
  return apiClient<void>(
    `/associations/${associationId}/finance/permissions/${userId}`,
    { token, method: 'DELETE' },
  );
}

export function listPermissions(token: string, associationId: string) {
  return apiClient<Array<{ id: string; user: { id: string; fullName: string }; grantedAt: string; isActive: boolean }>>(
    `/associations/${associationId}/finance/permissions`,
    { token },
  );
}

export function recordFeePayment(
  token: string,
  associationId: string,
  data: { membershipId: string; amountInKurus: number; month: string; description?: string },
) {
  return apiClient<{ id: string; membershipId: string; memberName: string; amountInKurus: number; month: string; paidAt: string }>(
    `/associations/${associationId}/finance/fees`,
    { token, method: 'POST', body: JSON.stringify(data) },
  );
}

export function getMemberFeeHistory(token: string, associationId: string, membershipId: string) {
  return apiClient<Array<{ id: string; membershipId: string; memberName: string; amountInKurus: number; month: string; paidAt: string }>>(
    `/associations/${associationId}/finance/fees/members/${membershipId}`,
    { token },
  );
}

export function listFeePayments(token: string, associationId: string) {
  return apiClient<Array<{ id: string; amountInKurus: number; month: string; memberName: string; description: string; paidAt: string }>>(
    `/associations/${associationId}/finance/fees`,
    { token },
  );
}
