import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@ticketbot/database';
import configuration from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { AssociationsModule } from './modules/associations/associations.module';
import { TitlesModule } from './modules/titles/titles.module';
import { UsersModule } from './modules/users/users.module';
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
    AssociationsModule,
    TitlesModule,
    UsersModule,
    JobsModule,
    BotModule,
  ],
})
export class AppModule {}
