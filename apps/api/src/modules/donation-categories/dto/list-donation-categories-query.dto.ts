import { createZodDto } from 'nestjs-zod';
import { listDonationCategoriesQuerySchema } from '@ticketbot/shared-validation';

export class ListDonationCategoriesQueryDto extends createZodDto(
  listDonationCategoriesQuerySchema,
) {}
