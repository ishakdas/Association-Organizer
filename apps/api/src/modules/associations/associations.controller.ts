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
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { AssociationsService } from './associations.service';
import { CreateAssociationDto } from './dto/create-association.dto';
import { ListAssociationsQueryDto } from './dto/list-associations-query.dto';

@Controller('associations')
@UseGuards(AuthGuard, SupabaseUserGuard)
@UsePipes(ZodValidationPipe)
export class AssociationsController {
  constructor(private readonly associationsService: AssociationsService) {}

  @Post()
  create(
    @Body() body: CreateAssociationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.associationsService.create(body, user.id);
  }

  @Get()
  list(@Query() query: ListAssociationsQueryDto) {
    return this.associationsService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.associationsService.findOne(id);
  }
}
