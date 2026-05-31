import { Module } from '@nestjs/common';
import { DonationCategoriesController } from './donation-categories.controller';
import { DonationCategoriesService } from './donation-categories.service';

@Module({
  controllers: [DonationCategoriesController],
  providers: [DonationCategoriesService],
  exports: [DonationCategoriesService],
})
export class DonationCategoriesModule {}
