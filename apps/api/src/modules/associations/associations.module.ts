import { Module } from '@nestjs/common';
import { AssociationsController } from './associations.controller';
import { AssociationsService } from './associations.service';
import { AssociationsRepository } from './associations.repository';

@Module({
  controllers: [AssociationsController],
  providers: [AssociationsService, AssociationsRepository],
  exports: [AssociationsService],
})
export class AssociationsModule {}
