import { createZodDto } from 'nestjs-zod';
import { updateDonationCategorySchema } from '@ticketbot/shared-validation';

export class UpdateDonationCategoryDto extends createZodDto(
  updateDonationCategorySchema,
) {}
