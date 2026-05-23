import { createZodDto } from 'nestjs-zod';
import { bulkFeePaymentSchema } from '@ticketbot/shared-validation';

export class BulkFeePaymentDto extends createZodDto(bulkFeePaymentSchema) {}
