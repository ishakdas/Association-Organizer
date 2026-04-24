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
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { UserRole } from '@ticketbot/database';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { TitlesService } from './titles.service';
import { CreateMemberTitleDto } from './dto/create-member-title.dto';
import { UpdateMemberTitleDto } from './dto/update-member-title.dto';

@Controller('member-titles')
@UseGuards(AuthGuard, SupabaseUserGuard, RolesGuard)
@UsePipes(ZodValidationPipe)
export class TitlesController {
  constructor(private readonly service: TitlesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @Roles(UserRole.SYSTEM_ADMIN)
  create(@Body() body: CreateMemberTitleDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  update(@Param('id') id: string, @Body() body: UpdateMemberTitleDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.SYSTEM_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
