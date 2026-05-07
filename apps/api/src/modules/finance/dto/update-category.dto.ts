import { createZodDto } from 'nestjs-zod';
import { updateTransactionCategorySchema } from '@ticketbot/shared-validation';

export class UpdateTransactionCategoryDto extends createZodDto(updateTransactionCategorySchema) {}
