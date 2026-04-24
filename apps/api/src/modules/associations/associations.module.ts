import { Module } from '@nestjs/common';
import { AssociationsController } from './associations.controller';
import { AssociationsService } from './associations.service';
import { AssociationsRepository } from './associations.repository';
import { AssociationMembersController } from './association-members.controller';
import { AssociationMembersService } from './association-members.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  controllers: [AssociationsController, AssociationMembersController],
  providers: [AssociationsService, AssociationsRepository, AssociationMembersService],
  exports: [AssociationsService, AssociationMembersService],
})
export class AssociationsModule {}
