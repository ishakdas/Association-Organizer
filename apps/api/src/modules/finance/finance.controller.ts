import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationRolesGuard } from '../../common/guards/association-roles.guard';
import { AssociationRoles } from '../../common/decorators/association-roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../common/decorators/current-user.decorator';
import { FinanceService } from './finance.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransactionCategoryDto } from './dto/create-category.dto';
import { UpdateTransactionCategoryDto } from './dto/update-category.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { RecordFeePaymentDto } from './dto/record-fee.dto';
import { GrantFinancePermissionDto } from './dto/grant-permission.dto';
import { AssociationSettingsDto } from './dto/settings.dto';
import { RecordEventExpenseDto } from './dto/record-event-expense.dto';

@Controller('associations/:associationId/finance')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class FinanceController {
  constructor(private readonly service: FinanceService) {}

  // --- Categories (sadece MANAGER) ---

  @Post('categories')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  createCategory(
    @Param('associationId') associationId: string,
    @Body() body: CreateTransactionCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createCategory(associationId, body, user);
  }

  @Get('categories')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  listCategories(
    @Param('associationId') associationId: string,
    @Query('type') type?: string,
  ) {
    return this.service.listCategories(associationId, type);
  }

  @Patch('categories/:categoryId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  updateCategory(
    @Param('associationId') associationId: string,
    @Param('categoryId') categoryId: string,
    @Body() body: UpdateTransactionCategoryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateCategory(associationId, categoryId, body, user);
  }

  @Delete('categories/:categoryId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  deleteCategory(
    @Param('associationId') associationId: string,
    @Param('categoryId') categoryId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.softDeleteCategory(associationId, categoryId, user);
  }

  // --- Transactions (MANAGER, SECRETARY, Finans yetkilisi) ---

  @Post('transactions')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  createTransaction(
    @Param('associationId') associationId: string,
    @Body() body: CreateTransactionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createTransaction(associationId, body, user);
  }

  @Get('transactions')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  listTransactions(
    @Param('associationId') associationId: string,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.service.listTransactions(associationId, query);
  }

  @Delete('transactions/:transactionId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  deleteTransaction(
    @Param('associationId') associationId: string,
    @Param('transactionId') transactionId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.softDeleteTransaction(
      associationId,
      transactionId,
      user,
    );
  }

  // --- Event expense ---

  @Post('events/:eventId/expense')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  recordEventExpense(
    @Param('associationId') associationId: string,
    @Param('eventId') eventId: string,
    @Body() body: RecordEventExpenseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.recordEventExpense(associationId, eventId, body, user);
  }

  // --- Fees ---

  @Post('fees')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  recordFeePayment(
    @Param('associationId') associationId: string,
    @Body() body: RecordFeePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.recordFeePayment(associationId, body, user);
  }

  @Get('fees')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  listFeePayments(@Param('associationId') associationId: string) {
    return this.service.listFeePayments(associationId);
  }

  @Get('fees/members/:membershipId')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getMemberFeeHistory(
    @Param('associationId') associationId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.service.getMemberFeeHistory(associationId, membershipId);
  }

  // --- Donations ---

  @Post('donations')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  recordDonation(
    @Param('associationId') associationId: string,
    @Body() body: { amountInKurus: number; description?: string },
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.recordDonation(
      associationId,
      body.amountInKurus,
      body.description ?? null,
      user,
    );
  }

  // --- Summary & Report ---

  @Get('summary')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getSummary(@Param('associationId') associationId: string) {
    return this.service.getSummary(associationId);
  }

  @Get('report')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getReport(
    @Param('associationId') associationId: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.service.getReport(associationId, fromDate, toDate);
  }

  @Get('monthly-stats')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getMonthlyStats(@Param('associationId') associationId: string) {
    return this.service.getMonthlyStats(associationId);
  }

  // --- Permissions (sadece MANAGER) ---

  @Post('permissions')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  grantPermission(
    @Param('associationId') associationId: string,
    @Body() body: GrantFinancePermissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.grantPermission(associationId, body.userId, user);
  }

  @Delete('permissions/:userId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  revokePermission(
    @Param('associationId') associationId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.revokePermission(associationId, userId, user);
  }

  @Get('permissions')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  listPermissions(@Param('associationId') associationId: string) {
    return this.service.listPermissions(associationId);
  }

  // --- Settings (sadece MANAGER) ---

  @Put('settings')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  updateSettings(
    @Param('associationId') associationId: string,
    @Body() body: AssociationSettingsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateSettings(associationId, body, user);
  }

  @Get('settings')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getSettings(@Param('associationId') associationId: string) {
    return this.service.getSettings(associationId);
  }
}
