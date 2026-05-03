import { createZodDto } from 'nestjs-zod';
import { resolveDisputeSchema } from '@ticketbot/shared-validation';

export class ResolveDisputeDto extends createZodDto(resolveDisputeSchema) {}
