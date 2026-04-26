import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationRolesGuard } from '../../common/guards/association-roles.guard';
import { AssociationRoles } from '../../common/decorators/association-roles.decorator';
import { AssociationMembersService } from './association-members.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

// `AssociationRolesGuard` binds role metadata to the `:id` param; the
// service additionally scopes `ensureMembership` by associationId so a
// membershipId from a different dernek cannot be mutated via this route.
@Controller('associations/:id/members')
@UseGuards(AuthGuard, SupabaseUserGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class AssociationMembersController {
  constructor(private readonly service: AssociationMembersService) {}

  @Post()
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  create(@Param('id') associationId: string, @Body() body: AddMemberDto) {
    return this.service.create(associationId, body);
  }

  @Get()
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  list(
    @Param('id') associationId: string,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.service.list(associationId, query);
  }

  @Patch(':membershipId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  update(
    @Param('id') associationId: string,
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.service.update(associationId, membershipId, body);
  }

  @Delete(':membershipId')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') associationId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.service.remove(associationId, membershipId);
  }

  @Post(':membershipId/telegram-link')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  generateTelegramLink(
    @Param('id') associationId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.service.generateTelegramLink(associationId, membershipId);
  }

  @Delete(':membershipId/telegram-link')
  @AssociationRoles(UserRole.ASSOCIATION_MANAGER)
  @HttpCode(HttpStatus.OK)
  unlinkTelegram(
    @Param('id') associationId: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.service.unlinkMemberTelegram(associationId, membershipId);
  }
}
