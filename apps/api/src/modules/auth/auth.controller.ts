import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { AdminService } from '../admin/admin.service';
import {
  telegramLinkRedeemSchema,
  TelegramLinkRedeemInput,
  updateProfileSchema,
  UpdateProfileInput,
  requestBranchRegistrationSchema,
  RequestBranchRegistrationInput,
  checkBranchEmailSchema,
  CheckBranchEmailInput,
  resendInviteForUserSchema,
  ResendInviteForUserInput,
} from '@ticketbot/shared-validation';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminService: AdminService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Patch('me')
  @UseGuards(AuthGuard, SupabaseUserGuard)
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.adminService.updateProfile(user.id, body);
  }

  @Post('complete-onboarding')
  @UseGuards(AuthGuard)
  completeOnboarding(@CurrentUser() user: RequestUser) {
    return this.authService.completeOnboarding(user.id);
  }

  @Post('clear-temp-password-flag')
  @UseGuards(AuthGuard, SupabaseUserGuard)
  @HttpCode(HttpStatus.OK)
  clearTempPasswordFlag(@CurrentUser() user: RequestUser) {
    return this.authService.clearTempPasswordFlag(user.id);
  }

  @Post('telegram-link')
  @UseGuards(AuthGuard)
  generateLinkToken(@CurrentUser() user: RequestUser) {
    return this.authService.generateLinkToken(user.id);
  }

  @Delete('telegram-link')
  @UseGuards(AuthGuard)
  unlinkTelegram(@CurrentUser() user: RequestUser) {
    return this.authService.unlinkTelegram(user.id);
  }

  @Post('redeem-telegram-link')
  redeemTelegramLink(
    @Body(new ZodValidationPipe(telegramLinkRedeemSchema)) body: TelegramLinkRedeemInput,
  ) {
    return this.authService.redeemLinkToken(body);
  }

  @Post('check-branch-email')
  @HttpCode(HttpStatus.OK)
  checkBranchEmail(
    @Body(new ZodValidationPipe(checkBranchEmailSchema)) body: CheckBranchEmailInput,
  ) {
    return this.authService.checkBranchEmail(body.email);
  }

  @Post('request-branch-registration')
  @HttpCode(HttpStatus.OK)
  requestBranchRegistration(
    @Body(new ZodValidationPipe(requestBranchRegistrationSchema)) body: RequestBranchRegistrationInput,
  ) {
    return this.authService.requestBranchRegistration(body);
  }

  @Get('pending-registrations')
  @UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  listPendingRegistrations() {
    return this.authService.listPendingRegistrations();
  }

  @Get('approved-registrations')
  @UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  listApprovedRegistrations() {
    return this.authService.listApprovedRegistrations();
  }

  @Post('pending-registrations/:id/approve')
  @UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  approveBranchRegistration(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.authService.approveBranchRegistration(id, user.id);
  }

  @Post('pending-registrations/:id/reject')
  @UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  rejectBranchRegistration(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.authService.rejectBranchRegistration(id, user.id);
  }

  @Post('pending-registrations/:id/resend')
  @UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  resendInvite(@Param('id') id: string) {
    return this.authService.resendInvite(id);
  }

  @Post('resend-invite-for-user')
  @UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  resendInviteForUser(
    @Body(new ZodValidationPipe(resendInviteForUserSchema)) body: ResendInviteForUserInput,
  ) {
    return this.authService.resendInviteForUser(body.userId);
  }
}
