import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@ticketbot/database';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { AssociationsModule } from './modules/associations/associations.module';
import { TitlesModule } from './modules/titles/titles.module';
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
import { BotModule } from 'bot';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    SupabaseModule,
    AuthModule,
    AssociationsModule,
    TitlesModule,
    UsersModule,
    JobsModule,
    TasksModule,
    MeetingsModule,
    EventsModule,
    EventRolesModule,
    IslamicCalendarModule,
    AiHelperModule,
    AdminModule,
    EmailModule,
    BotModule,
  ],
})
export class AppModule {}
