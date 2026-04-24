import {
  Controller,
  Get,
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
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AssociationsService } from './associations.service';
import { CreateAssociationDto } from './dto/create-association.dto';
import { ListAssociationsQueryDto } from './dto/list-associations-query.dto';

@Controller('associations')
@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.associationsService.findOne(id);
  }
}
