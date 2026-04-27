import { createZodDto } from 'nestjs-zod';
import { eventAssignmentInputSchema } from '@ticketbot/shared-validation';

export class AddEventAssignmentDto extends createZodDto(
  eventAssignmentInputSchema,
) {}
