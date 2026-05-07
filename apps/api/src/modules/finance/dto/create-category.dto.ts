import { createZodDto } from 'nestjs-zod';
import { createTransactionCategorySchema } from '@ticketbot/shared-validation';

export class CreateTransactionCategoryDto extends createZodDto(createTransactionCategorySchema) {}
