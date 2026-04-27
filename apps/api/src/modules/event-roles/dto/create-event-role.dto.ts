import { createZodDto } from 'nestjs-zod';
import { createEventRoleSchema } from '@ticketbot/shared-validation';

export class CreateEventRoleDto extends createZodDto(createEventRoleSchema) {}
