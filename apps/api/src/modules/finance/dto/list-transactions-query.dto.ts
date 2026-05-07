import { createZodDto } from 'nestjs-zod';
import { listTransactionsQuerySchema } from '@ticketbot/shared-validation';

export class ListTransactionsQueryDto extends createZodDto(listTransactionsQuerySchema) {}
