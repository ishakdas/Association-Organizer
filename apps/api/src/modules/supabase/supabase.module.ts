import { Module, Global } from '@nestjs/common';
import { SupabaseAdminService } from './supabase-admin.service';

@Global()
@Module({
  providers: [SupabaseAdminService],
  exports: [SupabaseAdminService],
})
export class SupabaseModule {}
