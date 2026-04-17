import { Controller, Post, Body, UseGuards, UsePipes } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuthService } from './auth.service';
import { telegramLinkRedeemSchema, TelegramLinkRedeemInput } from '@ticketbot/shared-validation';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram-link')
  @UseGuards(AuthGuard)
  generateLinkToken(@CurrentUser() user: RequestUser) {
    return this.authService.generateLinkToken(user.id);
  }

  @Post('redeem-telegram-link')
  redeemTelegramLink(
    @Body(new ZodValidationPipe(telegramLinkRedeemSchema)) body: TelegramLinkRedeemInput,
  ) {
    return this.authService.redeemLinkToken(body);
  }
}
