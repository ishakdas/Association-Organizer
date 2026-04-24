import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { SupabaseUserGuard } from '../../common/guards/supabase-user.guard';
import { TitlesService } from './titles.service';

@Controller('titles')
@UseGuards(AuthGuard, SupabaseUserGuard)
export class TitlesController {
  constructor(private readonly service: TitlesService) {}

  @Get()
  list() {
    return this.service.list();
  }
}
