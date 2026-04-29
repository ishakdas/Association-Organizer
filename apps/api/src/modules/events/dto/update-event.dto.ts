import { createZodDto } from 'nestjs-zod';
import { updateEventSchema } from '@ticketbot/shared-validation';

export class UpdateEventDto extends createZodDto(updateEventSchema) {}
