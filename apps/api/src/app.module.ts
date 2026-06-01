import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from '@ticketbot/database';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { AssociationsModule } from './modules/associations/associations.module';
import { TitlesModule } from './modules/titles/titles.module';
import { DonationCategoriesModule } from './modules/donation-categories/donation-categories.module';
import { UsersModule } from './modules/users/users.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { EventsModule } from './modules/events/events.module';
import { EventRolesModule } from './modules/event-roles/event-roles.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { AdminModule } from './modules/admin/admin.module';
import { EmailModule } from './modules/email/email.module';
import { IslamicCalendarModule } from './modules/islamic-calendar/islamic-calendar.module';
import { AiHelperModule } from './modules/ai-helper/ai-helper.module';
import { FinanceModule } from './modules/finance/finance.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { HealthModule } from './modules/health/health.module';
import { BotModule } from 'bot';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    // Rate limiting is NOT global (no APP_GUARD) — it only applies where
    // ThrottlerGuard is explicitly attached, namely the unauthenticated auth
    // endpoints (enumeration / email-spam / token brute-force). The `strict`
    // named limiter below is referenced via @Throttle on those handlers.
    ThrottlerModule.forRoot([
      { name: 'strict', ttl: 60_000, limit: 8 },
    ]),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    AssociationsModule,
    TitlesModule,
    DonationCategoriesModule,
    UsersModule,
    JobsModule,
    TasksModule,
    MeetingsModule,
    EventsModule,
    EventRolesModule,
    IslamicCalendarModule,
    AiHelperModule,
    FinanceModule,
    PermissionsModule,
    AdminModule,
    EmailModule,
    HealthModule,
    BotModule,
  ],
})
export class AppModule {}
