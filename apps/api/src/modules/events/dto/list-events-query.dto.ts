import { createZodDto } from 'nestjs-zod';
import { listEventsQuerySchema } from '@ticketbot/shared-validation';

export class ListEventsQueryDto extends createZodDto(listEventsQuerySchema) {}
