import { createZodDto } from 'nestjs-zod';
import { transferManagerSchema } from '@ticketbot/shared-validation';

export class TransferManagerDto extends createZodDto(transferManagerSchema) {}
