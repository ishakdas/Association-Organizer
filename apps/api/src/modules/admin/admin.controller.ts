import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ListAdminUsersQueryDto } from './dto/list-admin-users-query.dto';
import { ListAdminAssociationsQueryDto } from './dto/list-admin-associations-query.dto';

@Controller('admin')
@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
@Roles(UserRole.SYSTEM_ADMIN)
@UsePipes(ZodValidationPipe)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('users')
  listUsers(@Query() query: ListAdminUsersQueryDto) {
    return this.admin.listUsers(query);
  }

  @Get('system-admins')
  listSystemAdmins() {
    return this.admin.listSystemAdmins();
  }

  @Post('system-admins/:userId')
  @HttpCode(HttpStatus.OK)
  promote(@Param('userId') userId: string) {
    return this.admin.promoteToSystemAdmin(userId);
  }

  @Delete('system-admins/:userId')
  @HttpCode(HttpStatus.OK)
  revoke(
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.admin.revokeSystemAdmin(userId, user.id);
  }

  @Get('associations')
  listAssociations(@Query() query: ListAdminAssociationsQueryDto) {
    return this.admin.listAssociationsAdmin(query);
  }

  @Delete('associations/:id')
  @HttpCode(HttpStatus.OK)
  softDeleteAssociation(@Param('id') id: string) {
    return this.admin.softDeleteAssociation(id);
  }

  @Post('associations/:id/restore')
  @HttpCode(HttpStatus.OK)
  restoreAssociation(@Param('id') id: string) {
    return this.admin.restoreAssociation(id);
  }

  @Get('telegram-link-tokens')
  listLinkTokens() {
    return this.admin.listLinkTokens();
  }

  @Delete('telegram-link-tokens/:id')
  @HttpCode(HttpStatus.OK)
  deleteLinkToken(@Param('id') id: string) {
    return this.admin.deleteLinkToken(id);
  }
}
