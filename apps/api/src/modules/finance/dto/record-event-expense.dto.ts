import { createZodDto } from 'nestjs-zod';
import { recordEventExpenseSchema } from '@ticketbot/shared-validation';

export class RecordEventExpenseDto extends createZodDto(recordEventExpenseSchema) {}
