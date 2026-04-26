import {
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { AdminService } from '../admin/admin.service';
import {
  telegramLinkRedeemSchema,
  TelegramLinkRedeemInput,
  updateProfileSchema,
  UpdateProfileInput,
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
}
