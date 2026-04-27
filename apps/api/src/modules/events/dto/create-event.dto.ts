import { createZodDto } from 'nestjs-zod';
import { createEventSchema } from '@ticketbot/shared-validation';

export class CreateEventDto extends createZodDto(createEventSchema) {}
