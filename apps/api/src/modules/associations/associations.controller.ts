import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AssociationsService } from './associations.service';
import {
  createAssociationSchema,
  CreateAssociationInput,
  listAssociationsQuerySchema,
  ListAssociationsQuery,
} from '@ticketbot/shared-validation';

@Controller('associations')
@UseGuards(AuthGuard, SupabaseUserGuard)
export class AssociationsController {
  constructor(private readonly associationsService: AssociationsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createAssociationSchema)) body: CreateAssociationInput,
    @CurrentUser() user: RequestUser,
  ) {
    return this.associationsService.create(body, user.id);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(listAssociationsQuerySchema)) query: ListAssociationsQuery,
  ) {
    return this.associationsService.list(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.associationsService.findOne(id);
  }
}
