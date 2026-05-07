import { createZodDto } from 'nestjs-zod';
import { createTransactionSchema } from '@ticketbot/shared-validation';

export class CreateTransactionDto extends createZodDto(createTransactionSchema) {}
