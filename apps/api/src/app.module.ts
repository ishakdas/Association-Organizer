import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@ticketbot/database';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CommentsModule } from './modules/comments/comments.module';
import { OrganisationsModule } from './modules/organisations/organisations.module';
import { AssociationsModule } from './modules/associations/associations.module';
import { UsersModule } from './modules/users/users.module';
import { MeetingNotesModule } from './modules/meeting-notes/meeting-notes.module';
import { ExtensionsModule } from './modules/extensions/extensions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { BotModule } from 'bot';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    TicketsModule,
    CommentsModule,
    OrganisationsModule,
    AssociationsModule,
    UsersModule,
    MeetingNotesModule,
    ExtensionsModule,
    NotificationsModule,
    JobsModule,
    BotModule,
  ],
})
export class AppModule {}
