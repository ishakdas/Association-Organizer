import { createZodDto } from 'nestjs-zod';
import { recordFeePaymentSchema } from '@ticketbot/shared-validation';

export class RecordFeePaymentDto extends createZodDto(recordFeePaymentSchema) {}
