import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AssociationRolesGuard } from '../../common/guards/association-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AssociationRoles } from '../../common/decorators/association-roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AssociationsService } from './associations.service';
import { CreateAssociationDto } from './dto/create-association.dto';
import { ListAssociationsQueryDto } from './dto/list-associations-query.dto';

// Both role guards sit on the class. Each handler opts in via a decorator:
//   - `@Roles(SYSTEM_ADMIN)` on `create` (RolesGuard).
//   - `@AssociationRoles(...)` on `findOne` (AssociationRolesGuard binds to `:id`).
//   - `list` has no role decorator; the service filters by the caller's
//     active memberships so non-admins only see their own associations.
@Controller('associations')
@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard, AssociationRolesGuard)
@UsePipes(ZodValidationPipe)
export class AssociationsController {
  constructor(private readonly associationsService: AssociationsService) {}

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  create(
    @Body() body: CreateAssociationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.associationsService.create(body, user.id);
  }

  @Get()
  list(
    @Query() query: ListAssociationsQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.associationsService.list(query, user);
  }

  @Get(':id/stats')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  getStats(@Param('id') id: string) {
    return this.associationsService.getStats(id);
  }

  @Get(':id')
  @AssociationRoles(
    UserRole.ASSOCIATION_MANAGER,
    UserRole.ASSOCIATION_SECRETARY,
    UserRole.ASSOCIATION_MEMBER,
  )
  findOne(@Param('id') id: string) {
    return this.associationsService.findOne(id);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  delete(@Param('id') id: string) {
    return this.associationsService.delete(id);
  }
}
