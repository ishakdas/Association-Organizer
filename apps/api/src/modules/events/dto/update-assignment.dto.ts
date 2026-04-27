import { createZodDto } from 'nestjs-zod';
import { updateEventAssignmentSchema } from '@ticketbot/shared-validation';

export class UpdateEventAssignmentDto extends createZodDto(
  updateEventAssignmentSchema,
) {}
