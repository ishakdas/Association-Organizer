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
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { AssociationMembersService } from './association-members.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
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

  @Patch(':membershipId')
  update(
    @Param('membershipId') membershipId: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.service.update(membershipId, body);
  }

  @Delete(':membershipId')
  @HttpCode(HttpStatus.OK)
  remove(@Param('membershipId') membershipId: string) {
    return this.service.remove(membershipId);
  }
}
