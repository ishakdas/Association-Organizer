import { createZodDto } from 'nestjs-zod';
import { updateEventRoleSchema } from '@ticketbot/shared-validation';

export class UpdateEventRoleDto extends createZodDto(updateEventRoleSchema) {}
