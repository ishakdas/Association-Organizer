import { createZodDto } from 'nestjs-zod';
import { createDonationCategorySchema } from '@ticketbot/shared-validation';

export class CreateDonationCategoryDto extends createZodDto(
  createDonationCategorySchema,
) {}
