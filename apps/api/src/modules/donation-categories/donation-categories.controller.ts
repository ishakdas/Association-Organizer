import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { DonationCategoriesService } from './donation-categories.service';
import { CreateDonationCategoryDto } from './dto/create-donation-category.dto';
import { UpdateDonationCategoryDto } from './dto/update-donation-category.dto';
import { ListDonationCategoriesQueryDto } from './dto/list-donation-categories-query.dto';

@Controller('donation-categories')
@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
@UsePipes(ZodValidationPipe)
export class DonationCategoriesController {
  constructor(private readonly service: DonationCategoriesService) {}

  @Get()
  list(
    @Query() query: ListDonationCategoriesQueryDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Only SYSTEM_ADMIN can see archived (inactive) categories — everyone
    // else always gets the active-only list regardless of the flag.
    const includeInactive =
      query.includeInactive && user.systemRole === UserRole.SYSTEM_ADMIN;
    return this.service.list({ includeInactive });
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  create(@Body() body: CreateDonationCategoryDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateDonationCategoryDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
