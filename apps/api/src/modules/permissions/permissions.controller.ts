import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PermissionAction, UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationRolesGuard } from '../../common/guards/association-roles.guard';
import { AssociationRoles } from '../../common/decorators/association-roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PermissionService } from './permission.service';

// Permission management is a web-admin surface — SupabaseUserGuard rejects
// bot-token requests so a long-lived bot JWT can't be used to grant/revoke
// permissions, even for a user who holds a MANAGER membership.
@Controller('associations/:associationId/permissions')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
export class PermissionsController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get()
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  async getPermissions(@Param('associationId') associationId: string) {
    return this.permissionService.getAssociationPermissionSummary(associationId);
  }

  @Get(':userId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  async getUserPermissions(
    @Param('associationId') associationId: string,
    @Param('userId') userId: string,
  ) {
    return this.permissionService.getUserPermissions(associationId, userId);
  }

  @Post(':userId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  async grantPermission(
    @Param('associationId') associationId: string,
    @Param('userId') userId: string,
    @Body('action') action: PermissionAction,
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.grantPermission(associationId, userId, action, user);
  }

  @Delete(':userId/:action')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  async revokePermission(
    @Param('associationId') associationId: string,
    @Param('userId') userId: string,
    @Param('action') action: PermissionAction,
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.revokePermission(associationId, userId, action, user);
  }

  @Put(':userId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  async syncPermissions(
    @Param('associationId') associationId: string,
    @Param('userId') userId: string,
    @Body('actions') actions: PermissionAction[],
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.syncPermissions(associationId, userId, actions, user);
  }
}
