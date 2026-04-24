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
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationMembersService } from './association-members.service';
import { AddMemberDto } from './dto/add-member.dto';
import { ListMembersQueryDto } from './dto/list-members-query.dto';

@Controller('associations/:id/members')
@UseGuards(AuthGuard, SupabaseUserGuard)
@UsePipes(ZodValidationPipe)
export class AssociationMembersController {
  constructor(private readonly service: AssociationMembersService) {}

  @Post()
  create(@Param('id') associationId: string, @Body() body: AddMemberDto) {
    return this.service.create(associationId, body);
  }

  @Get()
  list(
    @Param('id') associationId: string,
    @Query() query: ListMembersQueryDto,
  ) {
    return this.service.list(associationId, query);
  }
}
